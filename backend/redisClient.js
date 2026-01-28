const { createClient } = require('redis');
const logger = require('./logger');

const REDIS_URL = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
const isTLS = REDIS_URL.startsWith('rediss://');

let isClosing = false;
let ready = false;

const clientOptions = {
    url: REDIS_URL,
    socket: {
        // Keep-alive helps survive platform idle reapers
        keepAlive: 15000,
        reconnectStrategy: retries => Math.min(retries * 1000, 10000),
        // Critical for Upstash/Render TLS
        tls: isTLS ? { rejectUnauthorized: false } : false,
        pingInterval: 15000,
    },
};

const pubClient = createClient(clientOptions);
const subClient = pubClient.duplicate();

pubClient.on('ready', () => {
    ready = true;
    logger.info('✅ Redis Pub READY');
});

subClient.on('ready', () => {
    // Both need to be ready for the adapter to be stable
    logger.info('✅ Redis Sub READY');
});

pubClient.on('connect', () => {
    logger.info('📡 Redis Pub: Connected (awaiting ready)');
});

pubClient.on('error', err => {
    ready = false;
    if (!isClosing) {
        if (err.message.includes('Socket closed unexpectedly')) {
            logger.warn('⚠️ Redis Pub error (expected during recovery): ' + err.message);
        } else {
            logger.error('❌ Redis Pub Client Error:', err);
        }
    }
});

subClient.on('error', err => {
    ready = false;
    if (!isClosing) {
        if (err.message.includes('Socket closed unexpectedly')) {
            logger.warn('⚠️ Redis Sub error (expected during recovery): ' + err.message);
        } else {
            logger.error('❌ Redis Sub Client Error:', err);
        }
    }
});

async function connectRedis() {
    if (ready && pubClient.isOpen && subClient.isOpen) return true;
    try {
        // Only attempt connect if not already open/opening
        if (!pubClient.isOpen) await pubClient.connect();
        if (!subClient.isOpen) await subClient.connect();
        return true;
    } catch (err) {
        if (!err.message.includes('already open')) {
            logger.error('❌ Redis connection attempt failed:', err.message);
        }
        return false;
    }
}

module.exports = {
    pubClient,
    subClient,
    connectRedis,
    isRedisReady: () => ready && pubClient.isOpen && subClient.isOpen,
    setClosing: v => (isClosing = v),
};
