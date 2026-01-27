const { createClient } = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    })]
});

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const isTLS = REDIS_URL.startsWith('rediss://');

// Robust Reconnect Strategy for production blips
const reconnectStrategy = (retries) => {
    // Start with 1s, max 10s, exponential-ish backoff
    const delay = Math.min(retries * 500, 10000);
    return delay;
};

const clientOptions = {
    url: REDIS_URL,
    socket: {
        reconnectStrategy,
        // Critical for Upstash/Render TLS handshake success
        tls: isTLS ? { rejectUnauthorized: false } : false,
        // Frequent pings prevent Render's idle reaper
        pingInterval: 15000,
        keepAlive: 15000,
        connectTimeout: 20000
    }
};

let pubClient = null;
let subClient = null;
let isConnected = false;
let isClosing = false;

function getClients() {
    if (!pubClient) {
        pubClient = createClient(clientOptions);
        subClient = pubClient.duplicate();

        // Handle Pub Client
        pubClient.on('connect', () => {
            isConnected = true;
            logger.info('✅ Redis Pub Client: Connected');
        });

        pubClient.on('error', (err) => {
            isConnected = false;
            if (err.message.includes('Socket closed unexpectedly')) {
                // Silently handle discovery/recovery spam
                logger.debug('Redis Socket: Recovery in progress...');
            } else if (!isClosing) {
                logger.error('❌ Redis Pub Client Error:', err);
            }
        });

        // Handle Sub Client
        subClient.on('connect', () => {
            logger.info('✅ Redis Sub Client: Connected');
        });

        subClient.on('error', (err) => {
            if (!err.message.includes('Socket closed unexpectedly') && !isClosing) {
                logger.error('❌ Redis Sub Client Error:', err);
            }
        });
    }

    return {
        pubClient,
        subClient,
        isRedisConnected: () => isConnected,
        setClosing: (val) => { isClosing = val; }
    };
}

module.exports = { getClients };
