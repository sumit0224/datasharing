const { createClient } = require('redis');
const logger = require('./logger');

/**
 * IMPORTANT:
 * REDIS_URL must be:
 * rediss://default:<PASSWORD>@<HOST>:6379
 */
const REDIS_URL = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
const isTLS = REDIS_URL.startsWith('rediss://');

let isClosing = false;

// Track readiness correctly (BOTH clients must be ready)
let pubReady = false;
let subReady = false;
let ready = false;

// Prevent duplicate connection attempts
let connecting = false;

const clientOptions = {
  url: REDIS_URL,
  socket: {
    // Keeps connection alive on Render / Upstash
    keepAlive: 15000,

    // Controlled reconnect (no storm)
    reconnectStrategy: retries => Math.min(retries * 1000, 10000),

    // Required for Upstash TLS
    tls: isTLS ? { rejectUnauthorized: false } : false,

    // Avoid idle disconnects
    pingInterval: 15000,
  },
};

const pubClient = createClient(clientOptions);
const subClient = pubClient.duplicate();

/* ---------------------------
   Redis Lifecycle Events
---------------------------- */

pubClient.on('connect', () => {
  logger.info('📡 Redis Pub: Connected (awaiting ready)');
});

subClient.on('connect', () => {
  logger.info('📡 Redis Sub: Connected (awaiting ready)');
});

pubClient.on('ready', () => {
  pubReady = true;
  ready = pubReady && subReady;
  logger.info('✅ Redis Pub READY');
});

subClient.on('ready', () => {
  subReady = true;
  ready = pubReady && subReady;
  logger.info('✅ Redis Sub READY');
});

pubClient.on('error', err => {
  pubReady = false;
  ready = false;

  if (!isClosing) {
    if (err?.message?.includes('Socket closed unexpectedly')) {
      logger.warn('⚠️ Redis Pub error (expected during recovery)');
    } else {
      logger.error('❌ Redis Pub Client Error:', err);
    }
  }
});

subClient.on('error', err => {
  subReady = false;
  ready = false;

  if (!isClosing) {
    if (err?.message?.includes('Socket closed unexpectedly')) {
      logger.warn('⚠️ Redis Sub error (expected during recovery)');
    } else {
      logger.error('❌ Redis Sub Client Error:', err);
    }
  }
});

/* ---------------------------
   Safe Connect Helper
---------------------------- */

async function connectRedis() {
  if (ready) return true;
  if (connecting) return false;

  connecting = true;

  try {
    if (!pubClient.isOpen) await pubClient.connect();
    if (!subClient.isOpen) await subClient.connect();
    return true;
  } catch (err) {
    logger.error('❌ Redis connection attempt failed:', err.message);
    return false;
  } finally {
    connecting = false;
  }
}

/* ---------------------------
   Exports
---------------------------- */

module.exports = {
  pubClient,
  subClient,
  connectRedis,
  isRedisReady: () => ready && pubClient.isOpen && subClient.isOpen,
  setClosing: v => (isClosing = v),
};
