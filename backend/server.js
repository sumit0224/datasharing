const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const requestIp = require('request-ip');
const winston = require('winston');
require('dotenv').config();
const path = require("path");

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
}
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp3|mp4|mov|avi|ppt|pptx|xls|xlsx|csv|json|xml|html|css|js/;

const TEXT_RETENTION_TIME = 10 * 60 * 1000;
const FILE_RETENTION_TIME = 2 * 60 * 1000;
const CLEANUP_INTERVAL = 30 * 1000;

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

let redisConnected = false;

pubClient.on('error', (err) => logger.error('Redis Pub Client Error:', err));
subClient.on('error', (err) => logger.error('Redis Sub Client Error:', err));

pubClient.on('connect', () => {
    redisConnected = true;
    logger.info('✅ Redis Pub Client connected');
});

subClient.on('connect', () => {
    logger.info('✅ Redis Sub Client connected');
});

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

Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('✅ Socket.IO Redis adapter configured');
    })
    .catch((err) => {
        logger.error('❌ Redis connection failed:', err);
        logger.warn('⚠️  Running without Redis (single-server mode)');
    });

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

app.use('/uploads', express.static(UPLOAD_DIR));

async function getRoom(roomId) {
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
    try {
        await pubClient.set(`room:${roomId}`, JSON.stringify(roomData));
        return true;
    } catch (err) {
        logger.error('Error updating room:', err);
        return false;
    }
}

async function getRoomUserCount(roomId) {
    try {
        const sockets = await io.in(roomId).fetchSockets();
        return sockets.length;
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
        redis: redisConnected,
        isReady: redisConnected,
        env: NODE_ENV,
        environment: NODE_ENV,
        version: '2.0.0'
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

        if (process.env.RENDER) {
            fs.unlink(req.file.path, (err) => {
                if (err) logger.error('Render unlink error:', err);
                else logger.info('Render: Cleaned up ephemeral disk after upload');
            });
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

    socket.on('join_room', async (roomId) => {
        try {
            if (currentRoom) {
                socket.leave(currentRoom);
                const userCount = await getRoomUserCount(currentRoom);
                io.to(currentRoom).emit('user_count', userCount);
            }

            currentRoom = roomId;
            socket.join(roomId);

            const room = await getRoom(roomId);
            const userCount = await getRoomUserCount(roomId);

            socket.emit('room_state', {
                roomId,
                texts: room.texts,
                files: room.files,
                userCount
            });

            io.to(roomId).emit('user_count', userCount);

            logger.info(`User ${socket.id} joined room ${roomId}. Users: ${userCount}`);
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
                senderId: socket.id.substring(0, 8)
            };

            room.texts.push(textEntry);

            if (room.texts.length > 100) {
                room.texts = room.texts.slice(-100);
            }

            await updateRoom(currentRoom, room);

            io.to(currentRoom).emit('text_shared', textEntry);

            logger.info(`Text shared in room ${currentRoom}`);
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
                const userCount = await getRoomUserCount(currentRoom);
                io.to(currentRoom).emit('user_count', userCount);
                logger.info(`User ${socket.id} left room ${currentRoom}. Users: ${userCount}`);
            } catch (err) {
                logger.error('Error in disconnect:', err);
            }
        }
        logger.info(`User disconnected: ${socket.id}`);
    });
});

async function cleanupOldData() {
    const now = Date.now();
    let deletedTexts = 0;
    let deletedFiles = 0;

    try {
        const keys = await pubClient.keys('room:*');

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
    clearInterval(cleanupIntervalId);
    cleanup();
    await pubClient.quit();
    await subClient.quit();
    process.exit(0);
});

process.on('SIGTERM', async () => {
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
📊 Redis: ${redisConnected ? 'Connected' : 'Disconnected (fallback mode)'}
🌍 Environment: ${NODE_ENV}
  `);
});
