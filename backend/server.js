const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const requestIp = require('request-ip');
const mongoose = require('mongoose');
const logger = require('./logger');
require('dotenv').config();

// Error handling
process.on('uncaughtException', err => {
    if (err?.message?.includes('Socket closed unexpectedly')) return;
    console.error('🔥 Uncaught Exception:', err.message);
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', err => {
    if (err?.message?.includes('Socket closed unexpectedly')) return;
    console.error('🔥 Unhandled Rejection:', err?.message);
    logger.error('Unhandled Rejection:', err);
});

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const NODE_ENV = (process.env.NODE_ENV || 'development').trim();
const MONGO_URI = process.env.MONGO_URI;

// DB Connection
if (!MONGO_URI) {
    logger.error('❌ MONGO_URI is missing!');
    process.exit(1);
}
mongoose.connect(MONGO_URI)
    .then(() => logger.info('✅ MongoDB Connected'))
    .catch(err => {
        logger.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

const Room = require('./models/Room');
const SharedText = require('./models/SharedText');

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp3|mp4|mov|avi|ppt|pptx|xls|xlsx|csv|json|xml|html|css|js/;

// --- STORAGE SETUP ---
const S3Storage = require('./utils/s3Storage');
const { getSignedDownloadUrl, deleteFile } = require('./utils/r2Client');

// --- IN-MEMORY PRESENCE (Unique Devices per Room) ---
const roomPresence = new Map(); // roomId -> Map(deviceId -> Set(socketIds))

// --- HELPER FUNCTIONS ---

async function getRoom(roomId) {
    try {
        const [room, texts] = await Promise.all([
            Room.findOne({ roomId }).lean(),
            SharedText.find({ roomId }).sort({ timestamp: 1 }).lean()
        ]);

        return {
            texts: (texts || []).map(t => ({ ...t, id: t._id.toString() })),
            files: room?.files || [],
            type: room?.type || 'public'
        };
    } catch (err) {
        logger.error(`Error fetching room ${roomId}:`, err);
    }
    return { texts: [], files: [], type: 'public' };
}

async function updateRoomFiles(roomId, files) {
    try {
        await Room.findOneAndUpdate(
            { roomId },
            { files, lastUpdated: new Date() },
            { upsert: true, new: true }
        );
        return true;
    } catch (err) {
        logger.error(`Error updating room files ${roomId}:`, err);
        return false;
    }
}

function getRoomUserCount(roomId) {
    const devices = roomPresence.get(roomId);
    return devices ? devices.size : 0;
}

function generateRoomId(ip) {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.includes('::ffff:127.0.0.1')) {
        return 'local-room';
    }
    if (ip.includes('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `room-${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return `room-${ip.replace(/[:.]/g, '-').substring(0, 20)}`;
}

async function broadcastRoomUpdate(roomId, eventName, payload) {
    io.to(roomId).emit(eventName, payload);
}

// --- SOCKET.IO ---
const io = new Server(server, {
    cors: {
        origin: (process.env.CLIENT_URL || 'http://localhost:5173').trim(),
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// --- MIDDLEWARE ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').trim(),
    credentials: true
}));

app.use(compression());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP.'
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many file uploads.'
});

app.use(express.json());
app.use(requestIp.mw());

// --- ROUTES ---

// Health Checks
app.get('/health/live', (req, res) => {
    res.status(200).json({ status: 'alive', uptime: process.uptime() });
});

app.get('/health/ready', (req, res) => {
    res.status(200).json({ status: 'ready', auth: { enabled: false }, environment: NODE_ENV });
});

// API Routes
app.get('/api/room-info', apiLimiter, async (req, res) => {
    try {
        const clientIp = req.clientIp;
        const roomId = generateRoomId(clientIp);
        const room = await getRoom(roomId);
        const userCount = getRoomUserCount(roomId);

        res.json({
            roomId,
            clientIp,
            userCount,
            texts: room.texts,
            files: room.files
        });
    } catch (err) {
        logger.error('Error in /api/room-info:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/room/:roomId', apiLimiter, async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await getRoom(roomId);
        const userCount = getRoomUserCount(roomId);

        res.json({
            roomId,
            userCount,
            texts: room.texts,
            files: room.files
        });
    } catch (err) {
        logger.error('Error in /api/room/:roomId:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/room/create', apiLimiter, async (req, res) => {
    try {
        const { expiresIn } = req.body;
        const clientIp = req.clientIp;
        const roomId = generateRoomId(clientIp) + '-' + Math.random().toString(36).substr(2, 4);

        let expiresAt = null;
        if (expiresIn) {
            const minutes = Number(expiresIn);
            if (!isNaN(minutes) && minutes > 0) {
                expiresAt = new Date(Date.now() + minutes * 60 * 1000);
            }
        }

        await Room.create({
            roomId,
            type: 'public',
            expiresAt,
            files: []
        });

        res.json({ roomId });
    } catch (err) {
        logger.error('Error creating room:', err);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// File Upload
const storage = S3Storage();
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED_FILE_TYPES.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type .${ext} is not allowed`), false);
    }
};
const uploadMiddleware = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });

app.post('/api/upload', uploadLimiter, uploadMiddleware.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const roomId = req.body.roomId || 'local-room';
        const room = await getRoom(roomId);

        const guestId = req.body.guestId || 'anon';
        const sender = {
            id: null,
            name: `Guest_${guestId.substring(0, 4)}`,
            avatarColor: '#667eea',
            isGuest: true
        };

        const fileInfo = {
            id: Date.now().toString(),
            originalName: req.file.originalname,
            key: req.file.key,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 2 * 60 * 1000),
            sender
        };
        fileInfo.downloadUrl = `/api/download/${fileInfo.id}?roomId=${roomId}`;

        room.files.push(fileInfo);
        await updateRoomFiles(roomId, room.files);
        await broadcastRoomUpdate(roomId, 'file_shared', fileInfo);

        logger.info(`File uploaded: ${fileInfo.originalName} to room ${roomId}`);
        res.json({ success: true, file: fileInfo });
    } catch (err) {
        logger.error('Error in /api/upload:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.get('/api/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const roomId = req.query.roomId;

        if (!roomId) return res.status(400).json({ error: 'Missing roomId param' });

        const room = await getRoom(roomId);
        const targetFile = room.files.find(f => f.id === fileId);

        if (targetFile && targetFile.key) {
            const signedUrl = await getSignedDownloadUrl(targetFile.key);
            if (signedUrl) return res.redirect(signedUrl);
        }

        res.status(404).json({ error: 'File not found or expired' });
    } catch (err) {
        logger.error('Download error:', err);
        res.status(500).json({ error: 'Internal Error' });
    }
});

app.delete('/api/file/:fileId', apiLimiter, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { roomId } = req.body;
        if (!roomId) return res.status(400).json({ error: 'Room ID required' });

        const room = await getRoom(roomId);
        const fileIndex = room.files.findIndex(f => f.id === fileId);

        if (fileIndex === -1) return res.status(404).json({ error: 'File not found' });

        const file = room.files[fileIndex];
        if (file.key) {
            try {
                await deleteFile(file.key);
            } catch (err) {
                logger.warn(`File already deleted or error: ${file.key}`, err.message);
            }
        }

        room.files.splice(fileIndex, 1);
        await updateRoomFiles(roomId, room.files);
        await broadcastRoomUpdate(roomId, 'file_deleted', { id: fileId, reason: 'manual' });

        res.json({ success: true });
    } catch (err) {
        logger.error('Error in /api/file/:fileId:', err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// --- SOCKET.IO HANDLING ---
io.on('connection', (socket) => {
    logger.info('🔌 New Client Connected:', socket.id);

    socket.on('join_room', async (roomId, deviceId, guestId) => {
        if (!roomId) return;

        const previousRoom = socket.data.currentRoom;
        if (previousRoom && previousRoom !== roomId) {
            socket.leave(previousRoom);
            if (roomPresence.has(previousRoom)) {
                const roomData = roomPresence.get(previousRoom);
                const dId = socket.data.deviceId;
                if (roomData.has(dId)) {
                    roomData.get(dId).delete(socket.id);
                    if (roomData.get(dId).size === 0) roomData.delete(dId);
                }
                if (roomData.size === 0) roomPresence.delete(previousRoom);
                broadcastRoomUpdate(previousRoom, 'user_count', getRoomUserCount(previousRoom));
            }
        }

        socket.join(roomId);
        socket.data.currentRoom = roomId;
        socket.data.deviceId = deviceId || `legacy_${socket.id.substring(0, 8)}`;
        socket.data.guestId = guestId || socket.data.deviceId.substring(0, 8);

        if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
        const roomData = roomPresence.get(roomId);
        const dId = socket.data.deviceId;
        if (!roomData.has(dId)) roomData.set(dId, new Set());
        roomData.get(dId).add(socket.id);

        const userCount = getRoomUserCount(roomId);
        await broadcastRoomUpdate(roomId, 'user_count', userCount);

        try {
            const room = await getRoom(roomId);
            socket.emit('room_state', {
                roomId,
                isPrivate: false,
                texts: room.texts,
                files: room.files,
                userCount
            });
        } catch (err) {
            logger.error('Error sending room state:', err);
        }
    });

    socket.on('send_text', async (data) => {
        const currentRoom = socket.data.currentRoom;
        if (!currentRoom) return;

        try {
            const sender = {
                id: null,
                name: `Guest_${socket.data.guestId.substring(0, 4)}`,
                avatarColor: '#667eea',
                isGuest: true
            };

            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

            const newText = await SharedText.create({
                roomId: currentRoom,
                content: data.content,
                sender,
                expiresAt
            });

            await broadcastRoomUpdate(currentRoom, 'text_shared', {
                id: newText._id.toString(),
                content: newText.content,
                timestamp: newText.timestamp,
                sender: newText.sender
            });
        } catch (err) {
            logger.error('Error in send_text:', err);
        }
    });

    socket.on('delete_text', async (textId) => {
        const currentRoom = socket.data.currentRoom;
        if (!currentRoom || !textId) {
            logger.warn(`⚠️ Deletion rejected: Missing roomId (${currentRoom}) or textId (${textId})`);
            return;
        }

        try {
            logger.info(`🗑️ Attempting to delete text ${textId} in room ${currentRoom}`);
            // Mongoose will automatically cast string to ObjectId if valid
            const deleted = await SharedText.findOneAndDelete({ _id: textId, roomId: currentRoom });

            if (deleted) {
                logger.info(`✅ Successfully deleted text: ${textId}`);
                await broadcastRoomUpdate(currentRoom, 'text_deleted', { id: textId });
            } else {
                logger.warn(`⚠️ Text not found for deletion: ${textId} in room ${currentRoom}`);
                // Still broadcast to sync UI just in case it's a ghost item
                await broadcastRoomUpdate(currentRoom, 'text_deleted', { id: textId });
            }
        } catch (err) {
            logger.error('Error in delete_text:', err);
        }
    });

    socket.on('clear_texts', async () => {
        const currentRoom = socket.data.currentRoom;
        if (!currentRoom) return;
        try {
            await SharedText.deleteMany({ roomId: currentRoom });
            await broadcastRoomUpdate(currentRoom, 'texts_cleared');
        } catch (err) {
            logger.error('Error in clear_texts:', err);
        }
    });

    socket.on('close_room', async () => {
        const currentRoom = socket.data.currentRoom;
        if (!currentRoom) return;

        try {
            await Promise.all([
                Room.deleteOne({ roomId: currentRoom }),
                SharedText.deleteMany({ roomId: currentRoom })
            ]);

            roomPresence.delete(currentRoom);
            io.to(currentRoom).emit('room_closed');
            setTimeout(() => {
                io.in(currentRoom).disconnectSockets();
            }, 100);

            logger.info(`✅ Room ${currentRoom} CLOSED/DELETED.`);
        } catch (err) {
            logger.error('Error closing room:', err);
        }
    });

    socket.on('disconnect', async () => {
        const currentRoom = socket.data.currentRoom;
        const dId = socket.data.deviceId;
        if (currentRoom && dId && roomPresence.has(currentRoom)) {
            const roomData = roomPresence.get(currentRoom);
            if (roomData.has(dId)) {
                roomData.get(dId).delete(socket.id);
                if (roomData.get(dId).size === 0) roomData.delete(dId);
            }
            if (roomData.size === 0) roomPresence.delete(currentRoom);

            const userCount = getRoomUserCount(currentRoom);
            await broadcastRoomUpdate(currentRoom, 'user_count', userCount);
        }
    });
});

// --- FILE CLEANUP ---
// Periodic cleanup for expired files (every 30 seconds)
setInterval(async () => {
    try {
        const now = new Date();
        const rooms = await Room.find({ 'files.0': { $exists: true } }).lean();

        for (const room of rooms) {
            const originalFileCount = room.files.length;
            const activeFiles = room.files.filter(file => {
                if (!file.expiresAt) return true; // Keep files without expiry
                return new Date(file.expiresAt) > now;
            });

            // If files were removed, update room and delete from storage
            if (activeFiles.length < originalFileCount) {
                const expiredFiles = room.files.filter(file => {
                    if (!file.expiresAt) return false;
                    return new Date(file.expiresAt) <= now;
                });

                // Delete from R2 storage and notify clients
                for (const file of expiredFiles) {
                    if (file.key) {
                        try {
                            await deleteFile(file.key);
                        } catch (err) {
                            logger.warn(`File already deleted or error: ${file.key}`, err.message);
                        }
                    }
                    io.to(room.roomId).emit('file_deleted', { id: file.id, reason: 'expired' });
                }

                // Update room
                await updateRoomFiles(room.roomId, activeFiles);
                logger.info(`🗑️ Cleaned ${expiredFiles.length} expired file(s) from room ${room.roomId}`);
            }
        }
    } catch (err) {
        logger.error('Error in file cleanup:', err);
    }
}, 30000); // Run every 30 seconds

// --- SERVER START ---
(async () => {
    try {
        server.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`🌍 Environment: ${NODE_ENV}`);
            logger.info(`💾 Database: MongoDB`);
            logger.info(`🗄️ Storage: Cloudflare R2`);
            logger.info(`🧠 Real-Time: In-Memory Adapter`);
            logger.info(`⏱️ Text Expiry: 10 Minutes | File Expiry: 2 Minutes`);
        });
    } catch (err) {
        logger.error('Failed to start server:', err);
        process.exit(1);
    }
})();
