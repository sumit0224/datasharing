const { createClient } = require('redis');
const logger = require('./logger');

/**
 * PRODUCTION-SAFE REDIS CLIENT
 * - Explicit connection required (node-redis v4+)
 * - Auto-reconnect on connection loss
 * - Upstash-compatible
 */

const REDIS_URL = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
let connected = false;
let isClosing = false;

const pubClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: retries => Math.min(retries * 1000, 10000),
    tls: REDIS_URL?.startsWith('rediss://')
      ? { rejectUnauthorized: false }
      : undefined,
    connectTimeout: 10000,
  },
});

const subClient = pubClient.duplicate();

/* ---------------------------
   Connection Lifecycle
---------------------------- */

async function connectRedis() {
  if (connected) return true;

  try {
    if (!pubClient.isOpen) await pubClient.connect();
    if (!subClient.isOpen) await subClient.connect();
    connected = true;
    logger.info('✅ Redis connected');
    return true;
  } catch (err) {
    logger.warn('⚠️ Redis connect failed:', err.message);
    return false;
  }
}

/* ---------------------------
   Event Handlers
---------------------------- */

pubClient.on('end', () => {
  connected = false;
  if (!isClosing) {
    logger.warn('⚠️ Redis connection closed (will auto-reconnect on next use)');
  }
});

subClient.on('end', () => {
  if (!isClosing) {
    logger.warn('⚠️ Redis sub connection closed');
  }
});

pubClient.on('error', err => {
  if (!isClosing && !err?.message?.includes('Socket closed unexpectedly')) {
    logger.error('❌ Redis Pub Error:', err.message);
  }
});

subClient.on('error', err => {
  if (!isClosing && !err?.message?.includes('Socket closed unexpectedly')) {
    logger.error('❌ Redis Sub Error:', err.message);
  }
});

/* ---------------------------
   Functional Health Check
---------------------------- */

async function checkRedisFunctional() {
  try {
    // Auto-heal: reconnect if closed
    if (!pubClient.isOpen) {
      await connectRedis();
    }

    const key = `healthcheck:functional:${process.pid}:${Date.now()}`;
    const value = Date.now().toString();

    await pubClient.set(key, value, { EX: 10 });
    const result = await pubClient.get(key);

    return result === value;
  } catch {
    return false;
  }
}

/* ---------------------------
   Exports
---------------------------- */

module.exports = {
  pubClient,
  subClient,
  connectRedis,
  checkRedisFunctional,
  isRedisReady: () => connected && pubClient.isOpen && subClient.isOpen,
  setClosing: v => {
    isClosing = v;
    connected = false;
  },
};
