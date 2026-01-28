const { createClient } = require('redis');
const logger = require('./logger');

/**
 * PRODUCTION-SAFE REDIS CLIENT (Upstash-Compatible)
 * - NEVER uses socket state for health determination
 * - Fire-and-forget connect pattern
 * - Functional health checks only
 * - Handles socket closures gracefully
 */

const REDIS_URL = (process.env.REDIS_URL || 'redis://localhost:6379').trim();
let connected = false;
let isClosing = false;

const pubClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: retries => Math.min(retries * 1000, 10000),
    connectTimeout: 10000,
  },
});

const subClient = pubClient.duplicate();

/* ---------------------------
   Event Handlers (CRITICAL: Must be first)
---------------------------- */

// Attach error handlers IMMEDIATELY to prevent crashes
pubClient.on('error', err => {
  // Socket closures are EXPECTED with Upstash - never log as error
  if (isClosing || err?.message?.includes('Socket closed unexpectedly')) return;
  logger.warn('⚠️ Redis Pub:', err.message);
});

subClient.on('error', err => {
  if (isClosing || err?.message?.includes('Socket closed unexpectedly')) return;
  logger.warn('⚠️ Redis Sub:', err.message);
});

pubClient.on('end', () => {
  connected = false;
  if (!isClosing) {
    logger.debug('Redis connection closed (normal with Upstash)');
  }
});

subClient.on('end', () => {
  if (!isClosing) {
    logger.debug('Redis sub connection closed');
  }
});

pubClient.on('ready', () => {
  connected = true;
  logger.info('✅ Redis Pub ready');
});

subClient.on('ready', () => {
  logger.info('✅ Redis Sub ready');
});

/* ---------------------------
   Fire-and-Forget Connect
---------------------------- */

function safeConnect(client, name) {
  // Don't reconnect if already open or connecting
  if (client.isOpen || client.isReady) return;

  client.connect().catch(err => {
    if (!err?.message?.includes('Socket closed unexpectedly')) {
      logger.warn(`⚠️ ${name} Redis connect failed: ${err.message}`);
    }
  });
}

function connectRedis() {
  safeConnect(pubClient, 'Pub');
  safeConnect(subClient, 'Sub');
}

/* ---------------------------
   Pure Functional Health Check
   ❌ NEVER checks socket state
   ✅ ONLY validates actual operations
---------------------------- */

async function checkRedisFunctional() {
  try {
    const key = `healthcheck:functional:${process.pid}:${Date.now()}`;
    const value = Date.now().toString();

    await pubClient.set(key, value, { EX: 10 });
    const result = await pubClient.get(key);

    return result === value;
  } catch (err) {
    // Silently fail - this is a probe, not an error
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
  setClosing: v => {
    isClosing = v;
    connected = false;
  },
};
