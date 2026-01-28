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
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const bcrypt = require('bcrypt');
const logger = require('./logger');
require('dotenv').config();

const { authMiddleware } = require('./middleware/authMiddleware');
const authController = require('./controllers/authController');
const { verifyAccessToken } = require('./utils/jwt');


const app = express();
app.set('trust proxy', 1); // Fix express-rate-limit X-Forwarded-For error
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const NODE_ENV = (process.env.NODE_ENV || 'development').trim();
const REDIS_URL = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
const MONGO_URI = process.env.MONGO_URI;

// MongoDB Connection
if (process.env.ENABLE_AUTH === 'true') {
    if (!MONGO_URI) {
        logger.error('❌ MONGO_URI is missing while ENABLE_AUTH is true');
    } else {
        mongoose.connect(MONGO_URI)
            .then(() => logger.info('✅ MongoDB Connected'))
            .catch(err => logger.error('❌ MongoDB Connection Error:', err));
    }
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp3|mp4|mov|avi|ppt|pptx|xls|xlsx|csv|json|xml|html|css|js/;
const TEXT_RETENTION_TIME = 10 * 60 * 1000;
const FILE_RETENTION_TIME = 2 * 60 * 1000;
const CLEANUP_INTERVAL = 30 * 1000;

const { pubClient, subClient, connectRedis, isRedisReady, setClosing } = require('./redisClient');
const S3Storage = require('./utils/s3Storage');
const { getSignedDownloadUrl, deleteFile } = require('./utils/r2Client');

// Room Snapshot Cache (Refresh Persistence)
const roomSnapshotCache = new Map(); // roomId -> { texts, files, lastUpdated }
const ROOM_REPAIR_CHANNEL = 'room:repair';
const PRESENCE_TTL = 60; // 60 seconds TTL for sockets

const PASSWORD_SALT_ROUNDS = 12;
const MAX_PASSWORD_ATTEMPTS = 5;
const PASSWORD_RATE_WINDOW = 60;

// Helper: Room Metadata (Redis)
async function setRoomMeta(roomId, meta) {
    if (!isRedisReady()) return;
    const key = `room:${roomId}:meta`;
    await pubClient.hSet(key, meta);
    if (meta.expiresAt) {
        const ttl = Math.ceil((new Date(meta.expiresAt).getTime() - Date.now()) / 1000);
        if (ttl > 0) await pubClient.expire(key, ttl);
    }
}

async function getRoomMeta(roomId) {
    if (!isRedisReady()) return null;
    const key = `room:${roomId}:meta`;
    const meta = await pubClient.hGetAll(key);
    return Object.keys(meta).length ? meta : null;
}

// Helper: Rate Limiting for Join
async function checkRateLimit(ip, roomId) {
    if (!isRedisReady()) return true; // Fail open if Redis down
    const key = `rate:join:${ip}:${roomId}`;
    const attempts = await pubClient.incr(key);
    if (attempts === 1) {
        await pubClient.expire(key, PASSWORD_RATE_WINDOW);
    }
    return attempts <= MAX_PASSWORD_ATTEMPTS;
}

// Task 3: Redis Pub/Sub for State Repair
subClient.subscribe(ROOM_REPAIR_CHANNEL, async (message) => {
    try {
        const { roomId } = JSON.parse(message);
        if (!roomId) return;

        if (isRedisReady()) {
            const data = await pubClient.get(`room:${roomId}`);
            if (data) {
                const parsed = JSON.parse(data);
                roomSnapshotCache.set(roomId, {
                    texts: parsed.texts,
                    files: parsed.files,
                    lastUpdated: Date.now()
                });
                logger.debug(`🔧 Room ${roomId} repaired via Pub/Sub`);
            }
        }
    } catch (err) {
        logger.error('Error in room repair listener:', err);
    }
});

async function broadcastRoomUpdate(roomId, eventName, payload) {
    io.to(roomId).emit(eventName, payload);
}

async function ensureRoomHydrated(roomId) {
    if (roomSnapshotCache.has(roomId)) return;
    if (!isRedisReady()) return;

    try {
        const data = await pubClient.get(`room:${roomId}`);
        if (data) {
            roomSnapshotCache.set(roomId, JSON.parse(data));
        } else {
            // Trigger repair if we missed it
            await pubClient.publish(ROOM_REPAIR_CHANNEL, JSON.stringify({ roomId }));
        }
    } catch (err) {
        logger.warn(`Failed to hydrate room ${roomId}:`, err.message);
    }
}

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

// Stabilized initialization (Golden Rule: Init adapter only when ready)
let adapterAttached = false;
let adapterWarningLogged = false;

async function attachRedisAdapter() {
    if (adapterAttached) return; // Already attached

    const ok = await connectRedis();
    if (!ok) {
        if (!adapterWarningLogged) {
            logger.warn('⚠️ Redis unavailable, running in single-instance mode');
            adapterWarningLogged = true;
        }
        return;
    }

    // Double-check readiness before attaching
    if (!isRedisReady()) {
        return;
    }

    try {
        io.adapter(createAdapter(pubClient, subClient));
        adapterAttached = true;
        logger.info('✅ Socket.IO Redis adapter attached');
    } catch (err) {
        logger.error('❌ Failed to attach Redis adapter:', err.message);
    }
}

// Attach on startup
attachRedisAdapter();

// Re-attach on reconnect
pubClient.on('ready', () => {
    logger.info('🔄 Redis re-connected, ensuring adapter is attached...');
    attachRedisAdapter();
});

// --- Socket.IO Handshake Authentication ---
io.use((socket, next) => {
    if (process.env.ENABLE_AUTH !== 'true') {
        socket.user = null;
        return next();
    }

    const rawCookies = socket.request.headers.cookie;
    if (!rawCookies) {
        socket.user = null;
        return next();
    }

    const parsedCookies = cookie.parse(rawCookies);
    const token = parsedCookies.accessToken;

    if (!token) {
        socket.user = null;
        return next();
    }

    try {
        const payload = verifyAccessToken(token);
        socket.user = {
            id: payload.sub,
            anonymousName: payload.anonymousName,
            avatarColor: payload.avatarColor,
            isGuest: false
        };
        logger.debug(`Socket authenticated: ${socket.user.anonymousName}`);
        next();
    } catch (err) {
        logger.debug('Socket auth failed:', err.message);
        socket.user = null;
        next();
    }
});

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

const authLimiter = {
    register: rateLimit({ windowMs: 60 * 1000, max: 3, message: { error: 'Too many registration attempts' } }),
    login: rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: 'Too many login attempts' } }),
    refresh: rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many refresh attempts' } })
};

app.use(express.json());
app.use(cookieParser());
app.use(requestIp.mw());
app.use(authMiddleware);

// --- Auth Routes ---
if (process.env.ENABLE_AUTH === 'true') {
    app.post('/api/auth/register', authLimiter.register, authController.register);
    app.post('/api/auth/login', authLimiter.login, authController.login);
    app.post('/api/auth/logout', authController.logout);
    app.get('/api/auth/me', authController.me);
    app.post('/api/auth/refresh', authLimiter.refresh, authController.refreshToken);
}

async function getRoom(roomId) {
    if (isRedisReady()) {
        try {
            const data = await pubClient.get(`room:${roomId}`);
            if (data) {
                const parsed = JSON.parse(data);

                // Sync snapshot cache
                roomSnapshotCache.set(roomId, {
                    texts: parsed.texts,
                    files: parsed.files,
                    lastUpdated: Date.now()
                });

                return parsed;
            }
        } catch (err) {
            logger.warn('Redis read failed, using snapshot cache');
        }
    }

    // Fallback to snapshot cache
    const snapshot = roomSnapshotCache.get(roomId);
    if (snapshot) {
        return {
            users: [],
            texts: snapshot.texts,
            files: snapshot.files
        };
    }

    return { users: [], texts: [], files: [] };
}

async function updateRoom(roomId, roomData) {
    // Always update snapshot cache first
    roomSnapshotCache.set(roomId, {
        texts: roomData.texts,
        files: roomData.files,
        lastUpdated: Date.now()
    });

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
        await pubClient.expire(deviceKey, PRESENCE_TTL); // Auto-expire sockets

        await pubClient.sAdd(roomKey, deviceId);
        await pubClient.expire(roomKey, 86400); // Room devices keep longer retention
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

const storage = S3Storage();

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

// Kubernetes-style Health Endpoints
// /health/live - Process liveness (NEVER depends on dependencies)
app.get('/health/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

// /health/ready - Dependency readiness
app.get('/health/ready', async (req, res) => {
    const requireRedis = process.env.REQUIRE_REDIS === 'true';
    let redisFunctional = true;

    if (requireRedis) {
        try {
            const key = `healthcheck:ready:${process.pid}`;
            const value = Date.now().toString();

            await pubClient.set(key, value, { EX: 10 });
            const result = await pubClient.get(key);

            redisFunctional = result === value;
        } catch {
            redisFunctional = false;
        }
    }

    if (requireRedis && !redisFunctional) {
        return res.status(503).json({
            status: 'not_ready',
            reason: 'Redis required but not functional',
            redis: {
                required: true,
                functional: false
            },
            auth: {
                enabled: process.env.ENABLE_AUTH === 'true'
            }
        });
    }

    res.status(200).json({
        status: 'ready',
        redis: {
            required: requireRedis,
            functional: true
        },
        auth: {
            enabled: process.env.ENABLE_AUTH === 'true'
        },
        environment: NODE_ENV,
        version: '2.0.0'
    });
});

// /health/redis - Functional Redis verification (SOURCE OF TRUTH)
app.get('/health/redis', async (req, res) => {
    try {
        // Auto-heal: reconnect if closed
        if (!pubClient.isOpen) {
            await connectRedis();
        }

        const key = `health:${process.pid}:${Date.now()}`;
        const value = Date.now().toString();

        await pubClient.set(key, value, { EX: 10 });
        const result = await pubClient.get(key);

        if (result !== value) {
            throw new Error('Redis read/write mismatch');
        }

        res.status(200).json({
            redis: 'ok',
            mode: 'functional',
            timestamp: Date.now()
        });
    } catch (err) {
        logger.warn('Redis health check failed:', err.message);
        res.status(503).json({
            redis: 'failed',
            error: err.message
        });
    }
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
        await ensureRoomHydrated(roomId);
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

app.post('/api/room/create', apiLimiter, async (req, res) => {
    try {
        const { type, password, expiresIn } = req.body;
        const clientIp = req.clientIp;

        // Generate a random ID for private rooms to avoid collisions
        const roomId = type === 'private'
            ? `private-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`
            : generateRoomId(clientIp);

        const meta = {
            type: type || 'public',
            createdAt: new Date().toISOString()
        };

        if (type === 'private') {
            if (!password || password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }
            meta.passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

            if (expiresIn) {
                const minutes = Number(expiresIn);
                if (!isNaN(minutes) && minutes > 0) {
                    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
                    meta.expiresAt = expiresAt.toISOString();
                    logger.info(`Creating Private Room ${roomId} with Expiry: ${meta.expiresAt} (in ${minutes} mins)`);
                }
            }
        }

        await setRoomMeta(roomId, meta);
        await updateRoom(roomId, { texts: [], files: [] }); // Initialize room

        res.json({ roomId });
    } catch (err) {
        logger.error('Error creating room:', err);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

app.post('/api/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const roomId = req.body.roomId || 'local-room';
        await ensureRoomHydrated(roomId);
        const room = await getRoom(roomId);

        // Use persistent guestId if available, fallback to deviceId
        const guestId = req.body.guestId || (req.body.deviceId || 'anon').substring(0, 8);

        const sender = {
            id: req.user ? req.user.id : null,
            name: req.user ? req.user.anonymousName : `Guest_${guestId}`,
            avatarColor: req.user ? req.user.avatarColor : '#667eea',
            isGuest: !req.user
        };

        const fileInfo = {
            id: Date.now().toString(),
            originalName: req.file.originalname,
            key: req.file.key, // From S3Storage
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date().toISOString(),
            sender
        };
        // Update: Download URL points to API, which redirects to R2
        fileInfo.downloadUrl = `/api/download/${fileInfo.id}?roomId=${roomId}`;

        room.files.push(fileInfo);
        await updateRoom(roomId, room);

        await broadcastRoomUpdate(roomId, 'file_shared', fileInfo);

        logger.info(`File uploaded: ${fileInfo.originalName} to room ${roomId} (Key: ${fileInfo.key})`);

        res.json({
            success: true,
            file: fileInfo
        });
    } catch (err) {
        logger.error('Error in /api/upload:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.get('/api/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const roomId = req.query.roomId; // Optional optimization if we passed it

        // We need to find the file metadata.
        // Since we don't have a global file index in Redis (only inside rooms),
        // we ideally need the roomId. 
        // If the frontend doesn't pass roomId in the download URL, we have to search or use a global mapping.
        // But wait, the frontend currently just links to `downloadUrl`. 
        // I set `downloadUrl` to `/api/download/${fileInfo.id}`.
        // Problem: Efficiently finding the R2 key from just fileId.
        // Solution: The Prompt says "Lookup file metadata from Redis".
        // Use `roomId` if available? 
        // Actually, for now, let's look for the room in the Referer or rely on the frontend passing it? 
        // Existing `downloadUrl` was static. 
        // I will update the `downloadUrl` to include `?roomId=${roomId}`.

        // Wait, I can't easily change the frontend to append query params if I just send `downloadUrl`.
        // I CAN include it in the `downloadUrl` string I construct! 
        // `downloadUrl: /api/download/${fileInfo.id}?roomId=${roomId}`

        let targetFile;
        // Search if roomId is provided
        if (roomId) {
            const room = await getRoom(roomId);
            targetFile = room.files.find(f => f.id === fileId);
        } else {
            // Fallback: This is expensive if we don't have roomId. 
            // But we can try to guess or return 400.
            return res.status(400).json({ error: 'Missing roomId param' });
        }

        if (targetFile && targetFile.key) {
            const signedUrl = await getSignedDownloadUrl(targetFile.key);
            if (signedUrl) {
                return res.redirect(signedUrl);
            }
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

        if (!roomId) {
            return res.status(400).json({ error: 'Room ID required' });
        }

        const room = await getRoom(roomId);
        const fileIndex = room.files.findIndex(f => f.id === fileId);

        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = room.files[fileIndex];

        // Async delete from R2 (fire and forget or await)
        if (file.key) {
            await deleteFile(file.key);
        }

        room.files.splice(fileIndex, 1);
        await updateRoom(roomId, room);

        await broadcastRoomUpdate(roomId, 'file_deleted', { id: fileId });

        res.json({ success: true });
    } catch (err) {
        logger.error('Error in /api/file/:fileId:', err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

io.on('connection', (socket) => {
    logger.info('🔌 New Client Connected:', socket.id);

    // Join room logic
    socket.on('join_room', async (roomId, rawPassword, deviceId, guestId) => {
        const password = typeof rawPassword === 'string' ? rawPassword : '';
        if (!roomId) return;

        // Leave previous room if any
        if (socket.rooms.size > 1) {
            const previousRoom = Array.from(socket.rooms).filter(r => r !== socket.id)[0];
            if (previousRoom) {
                socket.leave(previousRoom);
                if (socket.data.deviceId) {
                    await removeDevicePresence(previousRoom, socket.data.deviceId, socket.id);
                }
            }
        }

        // --- Private Room Security Check ---
        const meta = await getRoomMeta(roomId);

        // Fix: Detect if room is private but meta is missing (expired/deleted)
        if (!meta && roomId.startsWith('private-')) {
            socket.emit('room_error', { code: 'ROOM_NOT_FOUND', message: 'Room does not exist or has expired' });
            return;
        }

        if (meta && meta.type === 'private') {
            const clientIp = socket.handshake.address || socket.request.connection.remoteAddress;

            // Check Rate Limit
            const allowed = await checkRateLimit(clientIp, roomId);
            if (!allowed) {
                socket.emit('room_error', { code: 'TOO_MANY_ATTEMPTS', message: 'Too many failed attempts. Try again later.' });
                return;
            }

            // Verify Password
            const valid = password && await bcrypt.compare(password, meta.passwordHash);
            if (!valid) {
                // Log generic failure
                logger.warn(`Private room join failed: ${roomId} (Invalid Password) | IP: ${clientIp}`);
                socket.emit('room_error', { code: 'INVALID_PASSWORD', message: 'Incorrect room password' });
                return;
            }

            // Fix: Clear rate limit on success
            await pubClient.del(`rate:join:${clientIp}:${roomId}`);
        }

        socket.join(roomId);
        socket.data.currentRoom = roomId;
        // Prioritize legacy deviceId logic for uniqueness, but store guestId for display
        socket.data.deviceId = deviceId || `legacy_${socket.id.substring(0, 8)}`;
        socket.data.guestId = guestId || socket.data.deviceId.substring(0, 8);

        await addDevicePresence(roomId, socket.data.deviceId, socket.id);

        // Ensure we have fresh state
        await ensureRoomHydrated(roomId);

        const userCount = await getRoomUserCount(roomId);
        await broadcastRoomUpdate(roomId, 'user_count', userCount);

        logger.info(`User joined room: ${roomId} | Device: ${socket.data.deviceId} | User: ${socket.user ? socket.user.anonymousName : 'Guest'}`);

        // Send current room state
        try {
            const room = await getRoom(roomId);
            socket.emit('room_state', {
                roomId,
                isPrivate: meta && meta.type === 'private',
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
            await ensureRoomHydrated(currentRoom);
            const room = await getRoom(currentRoom);
            const sender = {
                id: socket.user ? socket.user.id : null,
                name: socket.user ? socket.user.anonymousName : `Guest_${socket.data.guestId}`,
                avatarColor: socket.user ? socket.user.avatarColor : '#667eea',
                isGuest: !socket.user
            };

            const textEntry = {
                id: Date.now().toString(),
                content: data.content,
                timestamp: new Date().toISOString(),
                sender
            };

            room.texts.push(textEntry);

            if (room.texts.length > 100) {
                room.texts = room.texts.slice(-100);
            }

            await updateRoom(currentRoom, room);

            await broadcastRoomUpdate(currentRoom, 'text_shared', textEntry);

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
            await broadcastRoomUpdate(currentRoom, 'texts_cleared');

            logger.info(`Texts cleared in room ${currentRoom}`);
        } catch (err) {
            logger.error('Error in clear_texts:', err);
        }
    });

    socket.on('close_room', async () => {
        const currentRoom = socket.data.currentRoom;
        if (!currentRoom) return;

        logger.info(`Request to CLOSE room: ${currentRoom} by ${socket.id}`);

        try {
            if (!isRedisReady()) {
                // Fallback for single instance (in-memory only)
                roomSnapshotCache.delete(currentRoom);
                io.to(currentRoom).emit('room_closed');
                io.in(currentRoom).disconnectSockets();
                return;
            }

            // 1. Get meta to check type (optional: verify password if needed more security later)
            const metaKey = `room:${currentRoom}:meta`;

            // 2. Delete all related keys
            await Promise.all([
                pubClient.del(`room:${currentRoom}:data`),
                pubClient.del(metaKey),
                pubClient.del(`presence:room:${currentRoom}:devices`),
                // Also need to clean up file metadata if strict, but auto-cleanup handles files eventually.
                // For immediate cleanup of files array in Redis:
                // (Already handled by deleting data key)
            ]);

            // 3. Clean up individual socket presence keys is hard without scanning, 
            // but they have TTLs so they will expire.
            // We should remove the room from the Set of active rooms if we tracked that.

            // 4. Broadcast Closure
            // Use broadcastRoomUpdate equivalent but specific event
            await pubClient.publish(ROOM_REPAIR_CHANNEL, JSON.stringify({
                type: 'ROOM_CLOSED',
                roomId: currentRoom
            }));

            // 5. Emit to local sockets immediately
            io.to(currentRoom).emit('room_closed');

            // 6. Force disconnect everyone in the room
            // Give them a split second to receive the event
            setTimeout(() => {
                io.in(currentRoom).disconnectSockets();
            }, 100);

            logger.info(`✅ Room ${currentRoom} DESTROYED and closed.`);

        } catch (err) {
            logger.error(`Error closing room ${currentRoom}:`, err);
            socket.emit('room_error', { message: 'Failed to close room' });
        }
    });

    socket.on('disconnect', async () => {
        const currentRoom = socket.data.currentRoom;
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

    // Distributed Lock
    const lockKey = 'cleanup:lock';
    const acquired = await pubClient.set(lockKey, String(process.pid), { NX: true, EX: 30 });
    if (!acquired) return; // Another instance is cleaning

    const now = Date.now();
    let deletedTexts = 0;
    let deletedFiles = 0;

    try {
        // SCAN for room keys (Non-blocking)
        let cursor = 0;
        do {
            const reply = await pubClient.scan(String(cursor), { MATCH: 'room:*', COUNT: 50 });
            cursor = reply.cursor;
            const keys = reply.keys;

            for (const key of keys) {
                // Fix: Skip meta keys to avoid WRONGTYPE errors on getRoom
                if (key.endsWith(':meta')) continue;

                const roomId = key.replace('room:', '');
                const room = await getRoom(roomId);
                let changed = false;

                const initialTextCount = room.texts.length;
                room.texts = room.texts.filter(text => {
                    const textAge = now - new Date(text.timestamp).getTime();
                    return textAge < TEXT_RETENTION_TIME;
                });
                if (room.texts.length !== initialTextCount) changed = true;
                deletedTexts += initialTextCount - room.texts.length;

                const filesToDelete = room.files.filter(file => {
                    const fileAge = now - new Date(file.uploadedAt).getTime();
                    return fileAge >= FILE_RETENTION_TIME;
                });

                filesToDelete.forEach(file => {
                    if (file.key) {
                        deleteFile(file.key).catch(err => logger.error('Cleanup R2 delete failed:', err));
                    }
                    io.to(roomId).emit('file_deleted', { id: file.id });
                });

                const initialFileCount = room.files.length;
                room.files = room.files.filter(file => {
                    const fileAge = now - new Date(file.uploadedAt).getTime();
                    return fileAge < FILE_RETENTION_TIME;
                });
                if (room.files.length !== initialFileCount) changed = true;
                deletedFiles += initialFileCount - room.files.length;

                if (changed) {
                    await updateRoom(roomId, room);
                }

                // Cleanup empty rooms from snapshot cache
                if (room.texts.length === 0 && room.files.length === 0) {
                    // Check if private room expired
                    const meta = await getRoomMeta(roomId);
                    if (meta && meta.expiresAt && new Date(meta.expiresAt) < new Date(now)) {
                        // Expired
                        await pubClient.del(`room:${roomId}:meta`);
                        await broadcastRoomUpdate(roomId, 'room_closed', { reason: 'expired' });
                        roomSnapshotCache.delete(roomId);
                        logger.info(`💀 Room ${roomId} expired and deleted`);
                    } else if (!meta || meta.type !== 'private') {
                        // Safety Check: If meta is missing but ID starts with 'private-',
                        // it might be a Redis glitch. Do NOT delete from cache.
                        if (!meta && roomId.startsWith('private-')) {
                            // logger.debug(`Skipping cleanup for private room ${roomId} with missing meta`);
                        } else {
                            // Public/Empty rooms cleanup
                            roomSnapshotCache.delete(roomId);
                        }
                    }
                }
            }
        } while (cursor !== 0);

        if (deletedTexts > 0 || deletedFiles > 0) {
            logger.info(`🧹 Cleanup: Removed ${deletedTexts} texts and ${deletedFiles} files`);
        }
    } catch (err) {
        if (err.message && (err.message.includes('client is closed') || err.message.includes('Socket closed'))) {
            logger.warn('⚠️ Redis connection lost during cleanup (skipping)');
        } else {
            logger.error('Error in cleanupOldData:', err);
        }
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

process.on('SIGINT', async () => {
    logger.info('⏹️  Shutting down gracefully...');
    setClosing(true);
    clearInterval(cleanupIntervalId);

    try {
        await pubClient.quit();
        await subClient.quit();
        logger.info('✅ Redis clients closed');
    } catch (err) {
        logger.warn('Redis cleanup error:', err.message);
    }

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

// 🔥 Connect Redis on boot (non-blocking - server starts regardless)
(async () => {
    try {
        await connectRedis();
    } catch (err) {
        logger.warn('⚠️ Redis connection failed on boot, will retry on first use:', err.message);
    }

    server.listen(PORT, () => {
        logger.info(`
🚀 Matchingo Server Running! (v2.0 - Production)
📡 Port: ${PORT}
🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}
📦 Max File Size: ${MAX_FILE_SIZE / 1024 / 1024}MB
⏰ Auto-cleanup: Texts (${TEXT_RETENTION_TIME / 60000}min) | Files (${FILE_RETENTION_TIME / 60000}min)
🔒 Security: Helmet, Rate Limiting, Compression
📊 Redis: ${isRedisReady() ? 'Connected' : 'Disconnected (fallback mode)'}
🌍 Environment: ${NODE_ENV}
📍 Platform: ${process.env.RENDER ? 'Render' : 'Local/VPS'}
    `);
    });
})();

