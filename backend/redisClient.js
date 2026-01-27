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

const reconnectStrategy = (retries) => {
    // Exponential backoff with a cap at 3 seconds
    const delay = Math.min(retries * 100, 3000);
    return delay;
};

const clientOptions = {
    url: REDIS_URL,
    socket: {
        reconnectStrategy,
        tls: isTLS,
        // Keep-alive settings for Upstash/Render
        pingInterval: 30000, // 30 seconds
        keepAlive: 30000,
        connectTimeout: 10000
    }
};

let pubClient = null;
let subClient = null;
let isConnected = false;

function getClients() {
    if (!pubClient) {
        pubClient = createClient(clientOptions);
        subClient = pubClient.duplicate();

        pubClient.on('connect', () => {
            isConnected = true;
            logger.info('🚀 Redis Pub Client connected');
        });

        pubClient.on('error', (err) => {
            isConnected = false;
            if (err.message.includes('Socket closed unexpectedly')) {
                logger.warn('⚠️ Redis Socket closed (reconnecting...)');
            } else {
                logger.error('❌ Redis Pub Client Error:', err);
            }
        });

        subClient.on('connect', () => {
            logger.info('🚀 Redis Sub Client connected');
        });

        subClient.on('error', (err) => {
            if (!err.message.includes('Socket closed unexpectedly')) {
                logger.error('❌ Redis Sub Client Error:', err);
            }
        });
    }

    return { pubClient, subClient, isRedisConnected: () => isConnected };
}

module.exports = { getClients };
