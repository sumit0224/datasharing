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
const UserStats = require('./models/UserStats');

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp3|mp4|mov|avi|ppt|pptx|xls|xlsx|csv|json|xml|html|css|js/;

// --- STORAGE SETUP ---
const S3Storage = require('./utils/s3Storage');
const { getSignedDownloadUrl, deleteFile } = require('./utils/r2Client');

// --- IN-MEMORY PRESENCE (Unique Devices per Room) ---
const roomPresence = new Map(); // roomId -> Map(deviceId -> Set(socketIds))

// --- VIDEO CALL STATE (Global) ---
const userCallState = new Map();   // userId (deviceId) -> { inCall, partnerId, socketId, status, connectedAt, disconnectedAt, timeoutId, createdAt }
const deviceSocketMap = new Map(); // deviceId -> socketId (O(1) lookup)

// --- CALL METRICS ---
const callMetrics = {
    totalCalls: 0,
    activeCalls: 0,
    completedCalls: 0,
    failedCalls: 0,
    totalDuration: 0, // In seconds
    averageDuration: 0
};

// --- CALL RATE LIMITING ---
const callAttempts = new Map(); // deviceId -> { count, resetAt }

// --- RANDOM VIDEO CHAT (Omegle-style) ---
const searchingUsers = new Map(); // userId -> { userId, socketId, region, timestamp, previousPartnerId, preferences }
const randomChatPairs = new Map(); // userId -> partnerId
const matchHistory = new Map(); // userId -> Set(recentPartnerIds)
const userReports = new Map(); // userId -> count

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

function getRoomUsers(roomId) {
    const devices = roomPresence.get(roomId);
    if (!devices) return [];

    return Array.from(devices.keys()).map(deviceId => ({
        id: deviceId,
        name: `Guest-${deviceId.slice(-4)}`
    }));
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

async function trackUser(deviceId) {
    try {
        await UserStats.findOneAndUpdate(
            { deviceId },
            {
                $set: { lastSeen: new Date() },
                $inc: { totalSessions: 1 },
                $setOnInsert: { firstSeen: new Date() }
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        logger.error('Error tracking user:', err);
    }
}

async function broadcastRoomUpdate(roomId, eventName, payload) {
    io.to(roomId).emit(eventName, payload);
}

function sendToRoom(roomId, eventName, payload) {
    io.to(roomId).emit(eventName, payload);
}

// --- VIDEO CALL HELPERS ---

/**
 * Get socket by device ID (O(1))
 * @param {string} deviceId 
 * @returns {import('socket.io').Socket|null}
 */
function getSocketByDeviceId(deviceId) {
    if (!deviceId) return null;
    const socketId = deviceSocketMap.get(deviceId);
    if (!socketId) return null;
    return io.sockets.sockets.get(socketId);
}

/**
 * Update call metrics
 * @param {string} event - 'call_started' | 'call_ended' | 'call_failed'
 * @param {Object} data - Optional data (e.g., duration)
 */
function updateCallMetrics(event, data = {}) {
    switch (event) {
        case 'call_started':
            callMetrics.totalCalls++;
            callMetrics.activeCalls++;
            break;
        case 'call_ended':
            if (callMetrics.activeCalls > 0) callMetrics.activeCalls--;
            callMetrics.completedCalls++;
            if (data.duration) {
                callMetrics.totalDuration += data.duration;
                callMetrics.averageDuration = callMetrics.totalDuration / callMetrics.completedCalls;
            }
            break;
        case 'call_failed':
            if (callMetrics.activeCalls > 0) callMetrics.activeCalls--;
            callMetrics.failedCalls++;
            break;
    }
}

/**
 * Check if a device is rate limited for call requests
 * @param {string} deviceId 
 * @returns {boolean} - true if allowed, false if limited
 */
function checkCallRateLimit(deviceId) {
    const now = Date.now();
    const attempt = callAttempts.get(deviceId);

    if (!attempt || now > attempt.resetAt) {
        callAttempts.set(deviceId, {
            count: 1,
            resetAt: now + 60000 // 1 minute window
        });
        return true;
    }

    if (attempt.count >= 10) return false;

    attempt.count++;
    return true;
}

// --- RANDOM MATCHING HELPERS ---

/**
 * Update match history to prevent immediate re-matching
 */
function updateMatchHistory(userId, partnerId) {
    if (!matchHistory.has(userId)) {
        matchHistory.set(userId, new Set());
    }

    const history = matchHistory.get(userId);
    history.add(partnerId);

    // Keep only last 5 partners
    if (history.size > 5) {
        const oldest = Array.from(history)[0];
        history.delete(oldest);
    }
}

/**
 * Find best match for a user
 * CRITICAL: Must prevent duplicate assignments and race conditions
 */
function findRandomMatch(userId, userRegion, previousPartnerId) {
    // Get all available users (exclude current user and previous partner)
    const available = Array.from(searchingUsers.entries())
        .filter(([id, data]) => {
            // Exclude self
            if (id === userId) return false;

            // Exclude if already matched
            if (randomChatPairs.has(id)) return false;

            // Exclude previous partner (avoid immediate re-match)
            if (id === previousPartnerId) return false;

            // Exclude recent matches (last 5 partners)
            const history = matchHistory.get(userId) || new Set();
            if (history.has(id)) return false;

            return true;
        });

    if (available.length === 0) return null;

    // Priority 1: Same region (faster connection)
    const sameRegion = available.filter(([id, data]) => data.region === userRegion);

    if (sameRegion.length > 0) {
        // Random selection from same region
        const randomIndex = Math.floor(Math.random() * sameRegion.length);
        return sameRegion[randomIndex][0];
    }

    // Priority 2: Any available user globally
    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex][0];
}

/**
 * Create a matched pair
 * Uses atomic operations to prevent race conditions
 */
function createRandomMatch(user1Id, user2Id) {
    // Double-check neither is already matched (race condition protection)
    if (randomChatPairs.has(user1Id) || randomChatPairs.has(user2Id)) {
        return null; // Race condition detected
    }

    // Atomic pair creation
    randomChatPairs.set(user1Id, user2Id);
    randomChatPairs.set(user2Id, user1Id);

    // Remove from searching pool
    const user1Data = searchingUsers.get(user1Id);
    const user2Data = searchingUsers.get(user2Id);
    searchingUsers.delete(user1Id);
    searchingUsers.delete(user2Id);

    // Update match history (remember last 5 partners)
    updateMatchHistory(user1Id, user2Id);
    updateMatchHistory(user2Id, user1Id);

    // Generate unique room ID for this pair
    const roomId = `random_${user1Id}_${user2Id}_${Date.now()}`;

    return {
        roomId,
        user1: user1Data,
        user2: user2Data
    };
}

// --- SOCKET.IO ---
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins for development (mobile app compatibility)
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
    origin: '*', // Allow all origins for development (mobile app compatibility)
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
        const users = getRoomUsers(roomId);

        res.json({
            roomId,
            clientIp,
            userCount,
            users,
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
        const users = getRoomUsers(roomId);

        res.json({
            roomId,
            userCount,
            users,
            texts: room.texts,
            files: room.files
        });
    } catch (err) {
        logger.error('Error in /api/room/:roomId:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Platform Statistics
app.get('/api/stats', apiLimiter, async (req, res) => {
    try {
        const totalUsers = await UserStats.countDocuments();
        const activeUsers = roomPresence.size; // Currently online rooms
        const totalActiveConnections = Array.from(roomPresence.values())
            .reduce((sum, deviceMap) => sum + deviceMap.size, 0);

        res.json({
            totalUsers,
            activeRooms: activeUsers,
            activeConnections: totalActiveConnections
        });
    } catch (err) {
        logger.error('Error in /api/stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/call-metrics', apiLimiter, (req, res) => {
    res.json({
        ...callMetrics,
        activeCallPairs: Math.floor(callMetrics.activeCalls / 2)
    });
});

const PushToken = require('./models/PushToken');
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

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

// --- PUSH NOTIFICATIONS ---

app.post('/api/notifications/register', async (req, res) => {
    try {
        const { token, deviceId } = req.body;

        if (!Expo.isExpoPushToken(token)) {
            return res.status(400).json({ error: 'Invalid Expo Push Token' });
        }

        await PushToken.findOneAndUpdate(
            { token },
            { token, deviceId, lastUsed: new Date() },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (err) {
        logger.error('Error registering push token:', err);
        res.status(500).json({ error: 'Failed to register token' });
    }
});

app.post('/api/notifications/broadcast', async (req, res) => {
    try {
        const { title, body } = req.body;

        // Simple security check (replace with real auth in production)
        // const { secret } = req.headers;
        // if (secret !== process.env.ADMIN_SECRET) return res.sendStatus(401);

        const tokens = await PushToken.find().distinct('token');
        if (tokens.length === 0) return res.json({ message: 'No devices registered' });

        const messages = [];
        for (let token of tokens) {
            if (!Expo.isExpoPushToken(token)) continue;
            messages.push({
                to: token,
                sound: 'default',
                title: title || 'New Notification',
                body: body || 'You have a new message!',
                data: { withSome: 'data' },
            });
        }

        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        for (let chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                logger.error('Error sending chunks:', error);
            }
        }

        res.json({ success: true, count: tokens.length, tickets });
    } catch (err) {
        logger.error('Error broadcasting notification:', err);
        res.status(500).json({ error: 'Failed to send notifications' });
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
        const source = req.headers['x-client-source'] || 'unknown';
        logger.info(`📤 File upload request from: ${source}`);

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
        const dId = deviceId || `legacy_${socket.id.substring(0, 8)}`;
        socket.data.deviceId = dId;
        socket.data.guestId = guestId || dId.substring(0, 8);

        // Map device to socket for O(1) lookup
        deviceSocketMap.set(dId, socket.id);

        // Track user for analytics
        await trackUser(dId);


        if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
        const roomData = roomPresence.get(roomId);
        if (!roomData.has(dId)) roomData.set(dId, new Set());
        roomData.get(dId).add(socket.id);

        const userCount = getRoomUserCount(roomId);
        const users = getRoomUsers(roomId);

        // Broadcast updated user count to ALL clients in the room (including the new one)
        await broadcastRoomUpdate(roomId, 'user_count', userCount);

        try {
            const room = await getRoom(roomId);
            socket.emit('room_state', {
                roomId,
                isPrivate: false,
                texts: room.texts,
                files: room.files,
                userCount,
                users
            });

            // Send an additional immediate user count update to ensure sync
            setTimeout(() => {
                broadcastRoomUpdate(roomId, 'user_count', getRoomUserCount(roomId));
            }, 100);
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


    // --- VIDEO CALL SIGNALING ---

    /**
     * Handle incoming call request from a user
     * @event call:request
     * @param {Object} data
     * @param {string} data.recipientId - Target device ID
     */
    socket.on('call:request', ({ recipientId }) => {
        const callerId = socket.data.deviceId || socket.id;

        try {
            // Rate Limiting
            if (!checkCallRateLimit(callerId)) {
                return socket.emit('call:error', {
                    reason: 'rate_limit_exceeded',
                    message: 'Too many call attempts. Please wait.'
                });
            }

            // Input Validation
            if (!recipientId || typeof recipientId !== 'string') {
                return socket.emit('call:error', {
                    reason: 'invalid_recipient',
                    message: 'Recipient ID must be a valid string'
                });
            }

            if (recipientId === callerId) {
                return socket.emit('call:error', {
                    reason: 'invalid_recipient',
                    message: 'Cannot call yourself'
                });
            }

            // Check if recipient is online
            const recipientSocket = getSocketByDeviceId(recipientId);

            if (!recipientSocket) {
                updateCallMetrics('call_failed');
                return socket.emit('call:error', { reason: 'user_offline' });
            }

            // Check if recipient is already in a call
            if (userCallState.has(recipientId)) {
                updateCallMetrics('call_failed');
                return socket.emit('call:error', { reason: 'user_busy' });
            }

            // Check if caller is already in a call
            if (userCallState.has(callerId)) {
                updateCallMetrics('call_failed');
                return socket.emit('call:error', { reason: 'already_in_call' });
            }

            // Auto-cancel timeout (60 seconds)
            const timeoutId = setTimeout(() => {
                const state = userCallState.get(callerId);
                if (state && state.status === 'calling') {
                    userCallState.delete(callerId);
                    userCallState.delete(recipientId);

                    const currentCallerSocket = getSocketByDeviceId(callerId);
                    if (currentCallerSocket) {
                        currentCallerSocket.emit('call:timeout', {
                            recipientId,
                            message: 'Call not answered'
                        });
                    }

                    const currentRecipientSocket = getSocketByDeviceId(recipientId);
                    if (currentRecipientSocket) {
                        currentRecipientSocket.emit('call:ended', {
                            peerId: callerId,
                            reason: 'timeout'
                        });
                    }

                    statusLogger('CALL_TIMEOUT', { callerId, recipientId });
                    updateCallMetrics('call_failed');
                }
            }, 60000);

            // Mark both users as "in call" (pending)
            userCallState.set(callerId, {
                inCall: false,
                partnerId: recipientId,
                socketId: socket.id,
                status: 'calling',
                createdAt: Date.now(),
                timeoutId
            });
            userCallState.set(recipientId, {
                inCall: false,
                partnerId: callerId,
                socketId: recipientSocket.id,
                status: 'ringing',
                createdAt: Date.now()
            });

            // Notify recipient of incoming call
            recipientSocket.emit('call:incoming', {
                callerId,
                callerName: socket.data.guestId || callerId
            });

            updateCallMetrics('call_started');
            statusLogger('CALL_REQUEST', { callerId, recipientId });
        } catch (error) {
            logger.error('Error in call:request:', error);
            socket.emit('call:error', { reason: 'server_error' });
        }
    });

    /**
     * Helper for consistent signaling logging
     * @param {string} event 
     * @param {Object} data 
     */
    function statusLogger(event, data) {
        logger.info(`📡 ${event}`, { ...data, timestamp: new Date().toISOString() });
    }

    /**
     * Handle user accepting an incoming call
     * @event call:accept
     * @param {Object} data
     * @param {string} data.callerId - Original caller device ID
     */
    socket.on('call:accept', ({ callerId }) => {
        const recipientId = socket.data.deviceId || socket.id;

        try {
            if (!callerId) {
                return socket.emit('call:error', { reason: 'invalid_caller_id' });
            }

            // Find caller's socket
            const callerSocket = getSocketByDeviceId(callerId);

            if (!callerSocket) {
                userCallState.delete(recipientId);
                userCallState.delete(callerId);
                return socket.emit('call:error', { reason: 'caller_offline' });
            }

            const callerState = userCallState.get(callerId);
            const recipientState = userCallState.get(recipientId);

            if (!callerState || callerState.partnerId !== recipientId) {
                return socket.emit('call:error', { reason: 'call_not_found' });
            }

            // Clear timeout
            if (callerState.timeoutId) {
                clearTimeout(callerState.timeoutId);
                delete callerState.timeoutId;
            }

            // Update call states to active
            const now = Date.now();
            callerState.inCall = true;
            callerState.status = 'active';
            callerState.connectedAt = now;

            if (recipientState) {
                recipientState.inCall = true;
                recipientState.status = 'active';
                recipientState.connectedAt = now;
            }

            // Notify both users to start WebRTC connection
            callerSocket.emit('call:accepted', {
                recipientId,
                isInitiator: true // Caller creates offer
            });
            socket.emit('call:accepted', {
                callerId,
                isInitiator: false // Recipient waits for offer
            });

            statusLogger('CALL_ACCEPTED', { callerId, recipientId });
        } catch (error) {
            logger.error('Error in call:accept:', error);
            socket.emit('call:error', { reason: 'server_error' });
        }
    });

    /**
     * Handle user rejecting an incoming call
     * @event call:reject
     * @param {Object} data
     * @param {string} data.callerId - Original caller device ID
     */
    socket.on('call:reject', ({ callerId }) => {
        const recipientId = socket.data.deviceId || socket.id;

        try {
            if (!callerId) return;

            // Find caller's socket
            const callerSocket = getSocketByDeviceId(callerId);

            // Cleanup call states
            userCallState.delete(callerId);
            userCallState.delete(recipientId);

            // Notify caller
            if (callerSocket) {
                callerSocket.emit('call:rejected', { recipientId });
            }

            statusLogger('CALL_REJECTED', { callerId, recipientId });
            updateCallMetrics('call_failed');
        } catch (error) {
            logger.error('Error in call:reject:', error);
        }
    });

    /**
     * Handle user ending an active call
     * @event call:ended
     * @param {Object} data
     * @param {string} data.peerId - Partner's device ID
     */
    socket.on('call:ended', ({ peerId }) => {
        const userId = socket.data.deviceId || socket.id;

        try {
            if (!peerId) return;

            // Find peer's socket
            const peerSocket = getSocketByDeviceId(peerId);

            const callState = userCallState.get(userId);
            const duration = callState && callState.connectedAt ? Math.floor((Date.now() - callState.connectedAt) / 1000) : 0;

            // Cleanup call states
            userCallState.delete(userId);
            userCallState.delete(peerId);

            // Notify peer
            if (peerSocket) {
                peerSocket.emit('call:ended', { peerId: userId });
            }

            statusLogger('CALL_ENDED', { userId, peerId, duration });
            updateCallMetrics('call_ended', { duration });
        } catch (error) {
            logger.error('Error in call:ended:', error);
        }
    });

    /**
     * Handle client re-establishing call state after reconnection
     * @event call:reconnect
     * @param {Object} data
     * @param {string} data.partnerId - Partner's device ID
     */
    socket.on('call:reconnect', ({ partnerId }) => {
        const userId = socket.data.deviceId || socket.id;

        try {
            if (!partnerId) return;

            const callState = userCallState.get(userId);

            if (callState && callState.partnerId === partnerId) {
                // Clear disconnection flag
                delete callState.disconnectedAt;
                callState.socketId = socket.id; // Update to new socket

                // Re-map device to new socket
                deviceSocketMap.set(userId, socket.id);

                // Notify partner of reconnection
                const partnerSocket = getSocketByDeviceId(partnerId);

                if (partnerSocket) {
                    partnerSocket.emit('call:partner_reconnected', {
                        peerId: userId
                    });
                }

                statusLogger('CALL_RECONNECTED', { userId, partnerId });
            } else {
                socket.emit('call:error', {
                    reason: 'reconnection_failed',
                    message: 'Active call session not found'
                });
            }
        } catch (error) {
            logger.error('Error in call:reconnect:', error);
            socket.emit('call:error', { reason: 'server_error' });
        }
    });

    /**
     * Relay SDP Offer
     * @event webrtc:offer
     */
    socket.on('webrtc:offer', ({ recipientId, offer }) => {
        try {
            if (!recipientId || !offer) {
                return socket.emit('call:error', { reason: 'invalid_signaling_data' });
            }

            const recipientSocket = getSocketByDeviceId(recipientId);

            if (recipientSocket) {
                const senderId = socket.data.deviceId || socket.id;
                recipientSocket.emit('webrtc:offer', { senderId, offer });
                logger.debug(`Relayed offer: ${senderId} → ${recipientId}`);
            } else {
                socket.emit('call:error', {
                    reason: 'recipient_offline',
                    action: 'offer_failed'
                });
            }
        } catch (error) {
            logger.error('Error in webrtc:offer:', error);
        }
    });

    /**
     * Relay SDP Answer
     * @event webrtc:answer
     */
    socket.on('webrtc:answer', ({ recipientId, answer }) => {
        try {
            if (!recipientId || !answer) {
                return socket.emit('call:error', { reason: 'invalid_signaling_data' });
            }

            const recipientSocket = getSocketByDeviceId(recipientId);

            if (recipientSocket) {
                const senderId = socket.data.deviceId || socket.id;
                recipientSocket.emit('webrtc:answer', { senderId, answer });
                logger.debug(`Relayed answer: ${senderId} → ${recipientId}`);
            } else {
                socket.emit('call:error', {
                    reason: 'recipient_offline',
                    action: 'answer_failed'
                });
            }
        } catch (error) {
            logger.error('Error in webrtc:answer:', error);
        }
    });

    /**
     * Relay ICE Candidate
     * @event webrtc:ice-candidate
     */
    socket.on('webrtc:ice-candidate', ({ recipientId, candidate }) => {
        try {
            if (!recipientId || !candidate) {
                return socket.emit('call:error', { reason: 'invalid_signaling_data' });
            }

            const recipientSocket = getSocketByDeviceId(recipientId);

            if (recipientSocket) {
                const senderId = socket.data.deviceId || socket.id;
                recipientSocket.emit('webrtc:ice-candidate', { senderId, candidate });
                logger.debug(`Relayed ICE candidate: ${senderId} → ${recipientId}`);
            }
        } catch (error) {
            logger.error('Error in webrtc:ice-candidate:', error);
        }
    });

    // --- END OF SOCKET HANDLERS ---
    /**
     * User starts searching for random match
     */
    socket.on('random:start_search', ({ region, preferences }) => {
        try {
            const userId = socket.data.deviceId || socket.id;

            // Validation
            if (randomChatPairs.has(userId)) {
                return socket.emit('random:error', {
                    reason: 'already_matched',
                    message: 'You are already in a chat. End current chat first.'
                });
            }

            if (searchingUsers.has(userId)) {
                return socket.emit('random:error', {
                    reason: 'already_searching',
                    message: 'Already searching for a match'
                });
            }

            // Get previous partner from match history to avoid re-matching
            const history = matchHistory.get(userId) || new Set();
            const previousPartnerId = Array.from(history).pop() || null;

            // Add to searching pool
            searchingUsers.set(userId, {
                userId,
                socketId: socket.id,
                region: region || 'global',
                timestamp: Date.now(),
                previousPartnerId,
                preferences: preferences || {}
            });

            // Acknowledge search started
            socket.emit('random:searching', {
                searchingCount: searchingUsers.size
            });

            // Try to find immediate match
            const partnerId = findRandomMatch(userId, region || 'global', previousPartnerId);

            if (partnerId) {
                // Match found! Create pair
                const match = createRandomMatch(userId, partnerId);

                if (match) {
                    const user1Socket = getSocketByDeviceId(userId);
                    const user2Socket = getSocketByDeviceId(partnerId);

                    if (user1Socket && user2Socket) {
                        // Notify both users
                        user1Socket.emit('random:matched', {
                            partnerId,
                            roomId: match.roomId,
                            partnerRegion: match.user2.region
                        });

                        user2Socket.emit('random:matched', {
                            partnerId: userId,
                            roomId: match.roomId,
                            partnerRegion: match.user1.region
                        });

                        logger.info(`🎲 Random match created: ${userId} ↔ ${partnerId}`);
                    }
                }
            }

            logger.info(`🔍 User searching: ${userId} (${searchingUsers.size} total)`);
        } catch (error) {
            logger.error('Error in random:start_search:', error);
            socket.emit('random:error', {
                reason: 'search_failed',
                message: 'Failed to start search'
            });
        }
    });

    /**
     * User stops searching (canceled)
     */
    socket.on('random:stop_search', () => {
        try {
            const userId = socket.data.deviceId || socket.id;

            if (searchingUsers.has(userId)) {
                searchingUsers.delete(userId);
                socket.emit('random:search_stopped');
                logger.info(`🛑 User stopped searching: ${userId}`);
            }
        } catch (error) {
            logger.error('Error in random:stop_search:', error);
        }
    });

    /**
     * User ends random chat
     */
    socket.on('random:end_chat', () => {
        try {
            const userId = socket.data.deviceId || socket.id;
            const partnerId = randomChatPairs.get(userId);

            if (!partnerId) {
                return socket.emit('random:error', {
                    reason: 'not_in_chat',
                    message: 'You are not in a random chat'
                });
            }

            // Get partner socket
            const partnerSocket = getSocketByDeviceId(partnerId);

            // Clean up pair
            randomChatPairs.delete(userId);
            randomChatPairs.delete(partnerId);

            // Notify both users
            socket.emit('random:chat_ended', { reason: 'user_ended' });
            if (partnerSocket) {
                partnerSocket.emit('random:chat_ended', { reason: 'partner_ended' });
            }

            logger.info(`👋 Random chat ended: ${userId} ↔ ${partnerId}`);
        } catch (error) {
            logger.error('Error in random:end_chat:', error);
        }
    });

    /**
     * User reports partner (abuse prevention)
     */
    socket.on('random:report', ({ partnerId, reason }) => {
        try {
            const userId = socket.data.deviceId || socket.id;

            // Log report for moderation
            logger.warn(`🚨 REPORT: ${userId} reported ${partnerId} for: ${reason}`);

            if (!userReports.has(partnerId)) {
                userReports.set(partnerId, 0);
            }
            const count = userReports.get(partnerId) + 1;
            userReports.set(partnerId, count);

            // Auto-ban/flag logic could go here

            socket.emit('random:report_submitted', {
                message: 'Report submitted. Thank you.'
            });
        } catch (error) {
            logger.error('Error in random:report:', error);
        }
    });

    /**
     * Skip to next random partner
     */
    socket.on('random:skip', () => {
        try {
            const userId = socket.data.deviceId || socket.id;
            const currentPartnerId = randomChatPairs.get(userId);

            if (!currentPartnerId) {
                return socket.emit('random:error', {
                    reason: 'not_in_chat',
                    message: 'You are not in a chat'
                });
            }

            // End current chat
            const partnerSocket = getSocketByDeviceId(currentPartnerId);

            randomChatPairs.delete(userId);
            randomChatPairs.delete(currentPartnerId);

            if (partnerSocket) {
                partnerSocket.emit('random:chat_ended', { reason: 'partner_skipped' });
            }

            // Immediately start searching for new match
            const region = socket.data.region || 'global';

            searchingUsers.set(userId, {
                userId,
                socketId: socket.id,
                region,
                timestamp: Date.now(),
                previousPartnerId: currentPartnerId, // Avoid re-matching
                preferences: {}
            });

            socket.emit('random:searching', {
                searchingCount: searchingUsers.size
            });

            // Try immediate match
            const newPartnerId = findRandomMatch(userId, region, currentPartnerId);

            if (newPartnerId) {
                const match = createRandomMatch(userId, newPartnerId);
                if (match) {
                    const user1Socket = getSocketByDeviceId(userId);
                    const user2Socket = getSocketByDeviceId(newPartnerId);

                    if (user1Socket && user2Socket) {
                        user1Socket.emit('random:matched', {
                            partnerId: newPartnerId,
                            roomId: match.roomId,
                            partnerRegion: match.user2.region
                        });
                        user2Socket.emit('random:matched', {
                            partnerId: userId,
                            roomId: match.roomId,
                            partnerRegion: match.user1.region
                        });
                    }
                }
            }

            logger.info(`⏭️ User skipped: ${userId} (previous: ${currentPartnerId})`);
        } catch (error) {
            logger.error('Error in random:skip:', error);
        }
    });


    socket.on('disconnect', async (reason) => {
        try {
            const userId = socket.data.deviceId || socket.id;

            // Handle random chat disconnect
            if (randomChatPairs.has(userId)) {
                const partnerId = randomChatPairs.get(userId);
                const partnerSocket = getSocketByDeviceId(partnerId);

                // Notify partner
                if (partnerSocket) {
                    partnerSocket.emit('random:chat_ended', {
                        reason: 'partner_disconnected'
                    });
                }

                // Cleanup
                randomChatPairs.delete(userId);
                randomChatPairs.delete(partnerId);
            }

            // Remove from searching pool
            if (searchingUsers.has(userId)) {
                searchingUsers.delete(userId);
            }
            const callState = userCallState.get(userId);

            if (callState && callState.partnerId) {
                const partnerId = callState.partnerId;
                logger.info(`User ${userId} disconnected during call. Reason: ${reason}. Starting 5s grace period...`);

                // Store disconnection time for grace period
                callState.disconnectedAt = Date.now();

                // Grace period: 5 seconds
                setTimeout(() => {
                    const currentState = userCallState.get(userId);

                    // Check if user reconnected (state would be updated or deleted)
                    if (currentState && currentState.disconnectedAt) {
                        // User didn't reconnect - end the call
                        const partnerSocket = getSocketByDeviceId(partnerId);

                        if (partnerSocket) {
                            partnerSocket.emit('call:ended', {
                                peerId: userId,
                                reason: 'partner_disconnected'
                            });
                        }

                        // Cleanup both users' call states
                        const duration = callState.connectedAt ? Math.floor((Date.now() - callState.connectedAt) / 1000) : 0;
                        updateCallMetrics('call_ended', { duration });

                        userCallState.delete(userId);
                        userCallState.delete(partnerId);

                        logger.info(`Call ended after grace period: ${userId} ↔ ${partnerId}`);
                    } else if (!currentState) {
                        logger.info(`Call state already cleaned up for ${userId}`);
                    } else {
                        logger.info(`User ${userId} reconnected within grace period, call preserved.`);
                    }
                }, 5000);
            }

            // Device Map Cleanup
            if (socket.data.deviceId) {
                deviceSocketMap.delete(socket.data.deviceId);
            }

            // Room Cleanup
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
                logger.info(`👋 Device ${dId.substring(0, 8)} left room ${currentRoom}. New count: ${userCount}`);

                // Immediate broadcast
                await broadcastRoomUpdate(currentRoom, 'user_count', userCount);

                // Additional delayed broadcast to ensure all clients receive the update
                setTimeout(() => {
                    broadcastRoomUpdate(currentRoom, 'user_count', getRoomUserCount(currentRoom));
                }, 100);
            }
        } catch (error) {
            logger.error('Error in disconnect handler:', error);
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

// --- USER COUNT SYNC ---
// Periodic sync to ensure all clients have accurate user counts
setInterval(() => {
    try {
        for (const [roomId, deviceMap] of roomPresence.entries()) {
            const userCount = deviceMap.size;
            io.to(roomId).emit('user_count', userCount);
        }
    } catch (err) {
        logger.error('Error in user count sync:', err);
    }
}, 5000); // Sync every 5 seconds

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
