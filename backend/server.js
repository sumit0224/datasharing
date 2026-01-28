const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const requestIp = require('request-ip');
const logger = require('./logger');
require('dotenv').config();


const app = express();
app.set('trust proxy', 1); // Fix express-rate-limit X-Forwarded-For error
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Serve static files from the uploads directory
app.use('/uploads', express.static(UPLOAD_DIR));

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp3|mp4|mov|avi|ppt|pptx|xls|xlsx|csv|json|xml|html|css|js/;

const TEXT_RETENTION_TIME = 10 * 60 * 1000;
const FILE_RETENTION_TIME = 2 * 60 * 1000;
const CLEANUP_INTERVAL = 30 * 1000;

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const { pubClient, subClient, connectRedis, isRedisReady, setClosing } = require('./redisClient');

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Stabilized initialization (Golden Rule: Init adapter only when ready)
async function attachRedisAdapter() {
    const ok = await connectRedis();
    if (!ok) {
        logger.warn('⚠️ Redis unavailable, running in single-instance mode');
        return;
    }

    try {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('✅ Socket.IO Redis adapter attached');
    } catch (err) {
        logger.error('❌ Failed to attach Redis adapter:', err.message);
    }
}

attachRedisAdapter();

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(compression());

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many file uploads, please try again later.'
});

app.use(express.json());
app.use(requestIp.mw());

async function getRoom(roomId) {
    if (!isRedisReady()) {
        logger.warn('Redis not ready, returning cached/empty room state');
        return { users: [], texts: [], files: [] };
    }
    try {
        const roomData = await pubClient.get(`room:${roomId}`);
        if (roomData) {
            return JSON.parse(roomData);
        }
        const newRoom = {
            users: [],
            texts: [],
            files: [],
            createdAt: new Date().toISOString()
        };
        await pubClient.set(`room:${roomId}`, JSON.stringify(newRoom));
        return newRoom;
    } catch (err) {
        logger.error('Error getting room:', err);
        return { users: [], texts: [], files: [] };
    }
}

async function updateRoom(roomId, roomData) {
    if (!isRedisReady()) return false;
    try {
        await pubClient.set(`room:${roomId}`, JSON.stringify(roomData));
        return true;
    } catch (err) {
        logger.error('Error updating room:', err);
        return false;
    }
}

// In-memory fallback for presence tracking if Redis is down
const inMemoryPresence = new Map(); // roomId -> Map<deviceId, Set<socketId>>

async function addDevicePresence(roomId, deviceId, socketId) {
    if (isRedisReady()) {
        const deviceKey = `presence:room:${roomId}:device:${deviceId}:sockets`;
        const roomKey = `presence:room:${roomId}:devices`;
        await pubClient.sAdd(deviceKey, socketId);
        await pubClient.sAdd(roomKey, deviceId);
        // Set TTL for presence keys (24 hours)
        await pubClient.expire(deviceKey, 86400);
        await pubClient.expire(roomKey, 86400);
    } else {
        if (!inMemoryPresence.has(roomId)) inMemoryPresence.set(roomId, new Map());
        const room = inMemoryPresence.get(roomId);
        if (!room.has(deviceId)) room.set(deviceId, new Set());
        room.get(deviceId).add(socketId);
    }
}

async function removeDevicePresence(roomId, deviceId, socketId) {
    if (!roomId || !deviceId) return;

    if (isRedisReady()) {
        const deviceKey = `presence:room:${roomId}:device:${deviceId}:sockets`;
        const roomKey = `presence:room:${roomId}:devices`;
        await pubClient.sRem(deviceKey, socketId);
        const remainingSockets = await pubClient.sCard(deviceKey);
        if (remainingSockets === 0) {
            await pubClient.sRem(roomKey, deviceId);
        }
    } else {
        const room = inMemoryPresence.get(roomId);
        if (room && room.has(deviceId)) {
            const deviceSockets = room.get(deviceId);
            deviceSockets.delete(socketId);
            if (deviceSockets.size === 0) {
                room.delete(deviceId);
            }
            if (room.size === 0) {
                inMemoryPresence.delete(roomId);
            }
        }
    }
}

async function getRoomUserCount(roomId) {
    try {
        if (isRedisReady()) {
            return await pubClient.sCard(`presence:room:${roomId}:devices`);
        } else {
            const room = inMemoryPresence.get(roomId);
            return room ? room.size : 0;
        }
    } catch (err) {
        logger.error('Error getting user count:', err);
        return 0;
    }
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED_FILE_TYPES.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type .${ext} is not allowed`), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
        redis: isRedisReady(),
        isReady: isRedisReady(),
        env: NODE_ENV,
        environment: NODE_ENV,
        version: '2.0.0',
        render: !!process.env.RENDER
    });
});

app.get('/api/room-info', apiLimiter, async (req, res) => {
    try {
        const clientIp = req.clientIp;
        const roomId = generateRoomId(clientIp);
        const room = await getRoom(roomId);
        const userCount = await getRoomUserCount(roomId);

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
        const userCount = await getRoomUserCount(roomId);

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

app.post('/api/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const roomId = req.body.roomId || 'local-room';
        const room = await getRoom(roomId);

        const fileInfo = {
            id: Date.now().toString(),
            originalName: req.file.originalname,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date().toISOString(),
            downloadUrl: `/uploads/${req.file.filename}`
        };

        room.files.push(fileInfo);
        await updateRoom(roomId, room);

        io.to(roomId).emit('file_shared', fileInfo);

        logger.info(`File uploaded: ${fileInfo.originalName} to room ${roomId}`);

        res.json({
            success: true,
            file: fileInfo
        });

        if (!process.env.RENDER) {
            fs.unlink(req.file.path, (err) => {
                if (err) logger.error('File cleanup error:', err);
                else logger.info('Local: Cleaned up file after upload');
            });
        } else {
            logger.info('Render: Skipping immediate unlink for ephemeral persistence');
        }
    } catch (err) {
        logger.error('Error in /api/upload:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.get('/api/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.delete('/api/file/:fileId', apiLimiter, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({ error: 'Room ID required' });
        }

        const room = await getRoom(roomId);
        const fileIndex = room.files.findIndex(f => f.id === fileId);

        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = room.files[fileIndex];
        const filePath = path.join(UPLOAD_DIR, file.filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        room.files.splice(fileIndex, 1);
        await updateRoom(roomId, room);

        io.to(roomId).emit('file_deleted', { id: fileId });

        res.json({ success: true });
    } catch (err) {
        logger.error('Error in /api/file/:fileId:', err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);

    let currentRoom = null;

    socket.on('join_room', async (roomId, deviceId) => {
        try {
            if (currentRoom) {
                socket.leave(currentRoom);
                await removeDevicePresence(currentRoom, socket.data.deviceId, socket.id);
                const userCount = await getRoomUserCount(currentRoom);
                io.to(currentRoom).emit('user_count', userCount);
            }

            currentRoom = roomId;
            socket.data.roomId = roomId;
            socket.data.deviceId = deviceId || `legacy_${socket.id.substring(0, 8)}`;
            socket.join(roomId);

            await addDevicePresence(roomId, socket.data.deviceId, socket.id);
            const room = await getRoom(roomId);
            const userCount = await getRoomUserCount(roomId);

            socket.emit('room_state', {
                roomId,
                texts: room.texts,
                files: room.files,
                userCount
            });

            io.to(roomId).emit('user_count', userCount);

            logger.info(`User ${socket.id} (Device: ${socket.data.deviceId}) joined room ${roomId}. Unique Devices: ${userCount}`);
        } catch (err) {
            logger.error('Error in join_room:', err);
        }
    });

    socket.on('send_text', async (data) => {
        if (!currentRoom) return;

        try {
            const room = await getRoom(currentRoom);
            const textEntry = {
                id: Date.now().toString(),
                content: data.content,
                timestamp: new Date().toISOString(),
                senderId: (socket.data.deviceId || socket.id).substring(0, 8)
            };

            room.texts.push(textEntry);

            if (room.texts.length > 100) {
                room.texts = room.texts.slice(-100);
            }

            await updateRoom(currentRoom, room);

            io.to(currentRoom).emit('text_shared', textEntry);

            logger.info(`Text shared in room ${currentRoom} by ${socket.id}`);
        } catch (err) {
            logger.error('Error in send_text:', err);
        }
    });

    socket.on('clear_texts', async () => {
        if (!currentRoom) return;

        try {
            const room = await getRoom(currentRoom);
            room.texts = [];
            await updateRoom(currentRoom, room);
            io.to(currentRoom).emit('texts_cleared');

            logger.info(`Texts cleared in room ${currentRoom}`);
        } catch (err) {
            logger.error('Error in clear_texts:', err);
        }
    });

    socket.on('disconnect', async () => {
        if (currentRoom) {
            try {
                await removeDevicePresence(currentRoom, socket.data.deviceId, socket.id);
                const userCount = await getRoomUserCount(currentRoom);
                io.to(currentRoom).emit('user_count', userCount);
                logger.info(`User ${socket.id} left room ${currentRoom}. Unique Devices: ${userCount}`);
            } catch (err) {
                logger.error('Error in disconnect:', err);
            }
        }
        logger.info(`User disconnected: ${socket.id}`);
    });
});

async function cleanupOldData() {
    if (!isRedisReady()) return;
    const now = Date.now();
    let deletedTexts = 0;
    let deletedFiles = 0;

    try {
        const keys = await pubClient.keys('room:*');
        if (!keys || keys.length === 0) return;

        for (const key of keys) {
            const roomId = key.replace('room:', '');
            const room = await getRoom(roomId);

            const initialTextCount = room.texts.length;
            room.texts = room.texts.filter(text => {
                const textAge = now - new Date(text.timestamp).getTime();
                return textAge < TEXT_RETENTION_TIME;
            });
            deletedTexts += initialTextCount - room.texts.length;

            const filesToDelete = room.files.filter(file => {
                const fileAge = now - new Date(file.uploadedAt).getTime();
                return fileAge >= FILE_RETENTION_TIME;
            });

            filesToDelete.forEach(file => {
                const filePath = path.join(UPLOAD_DIR, file.filename);
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        logger.info(`🗑️  Auto-deleted file: ${file.originalName}`);
                    } catch (err) {
                        logger.error(`Failed to delete file ${file.filename}:`, err);
                    }
                }
                io.to(roomId).emit('file_deleted', { id: file.id });
            });

            const initialFileCount = room.files.length;
            room.files = room.files.filter(file => {
                const fileAge = now - new Date(file.uploadedAt).getTime();
                return fileAge < FILE_RETENTION_TIME;
            });
            deletedFiles += initialFileCount - room.files.length;

            if (deletedTexts > 0 || deletedFiles > 0) {
                await updateRoom(roomId, room);
            }
        }

        if (deletedTexts > 0 || deletedFiles > 0) {
            logger.info(`🧹 Cleanup: Removed ${deletedTexts} texts and ${deletedFiles} files`);
        }
    } catch (err) {
        logger.error('Error in cleanupOldData:', err);
    }
}

const cleanupIntervalId = setInterval(cleanupOldData, CLEANUP_INTERVAL);

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Max size is 100MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

function cleanup() {
    logger.info('Cleaning up uploads...');
    if (fs.existsSync(UPLOAD_DIR)) {
        const files = fs.readdirSync(UPLOAD_DIR);
        files.forEach(file => {
            fs.unlinkSync(path.join(UPLOAD_DIR, file));
        });
    }
    logger.info('Cleanup complete.');
}

process.on('SIGINT', async () => {
    setClosing(true);
    clearInterval(cleanupIntervalId);
    cleanup();
    await pubClient.quit();
    await subClient.quit();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    setClosing(true);
    clearInterval(cleanupIntervalId);
    cleanup();
    await pubClient.quit();
    await subClient.quit();
    process.exit(0);
});

server.listen(PORT, () => {
    logger.info(`
🚀 Machingo Server Running! (v2.0 - Production)
📡 Port: ${PORT}
🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}
📁 Uploads: ${UPLOAD_DIR}
📦 Max File Size: ${MAX_FILE_SIZE / 1024 / 1024}MB
⏰ Auto-cleanup: Texts (10min) | Files (2min)
🔒 Security: Helmet, Rate Limiting, Compression
📊 Redis: ${isRedisReady() ? 'Connected' : 'Disconnected (fallback mode)'}
🌍 Environment: ${NODE_ENV}
📍 Platform: ${process.env.RENDER ? 'Render' : 'Local/VPS'}
  `);
});
