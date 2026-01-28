# Redis Production Hardening - Summary

## Changes Applied

### 1. Redis Client (`redisClient.js`)

**Conservative Reconnect Strategy**:
- Bounded retry (max 10 attempts before fallback)
- Exponential backoff capped at 10s
- Removed aggressive `keepAlive`/`pingInterval` (Upstash manages this)

**Disconnect Tracking**:
- Tracks when Redis goes down (`lastDisconnectTime`)  
- Logs downtime duration on reconnect
- Single warning log per disconnect cycle (no spam)

**Error Handling**:
- "Socket closed unexpectedly" → `WARN` (not ERROR)
- Only log once per disconnect
- All other errors → `ERROR`

### 2. Health Endpoints (`server.js`)

**Split into two endpoints** (Kubernetes pattern):

#### `/health/live`
- **Always returns 200** 
- Checks only if the Node.js process is running
- **NEVER depends on Redis or other dependencies**
- For Kubernetes liveness probes / Render health checks

#### `/health/ready`
- Returns **503** if `REQUIRE_REDIS=true` and Redis is unavailable
- Returns **200** when all dependencies are ready
- Includes:
  - `redis.connected` - Current Redis status
  - `redis.adapterAttached` - Socket.IO adapter status  
  - `redis.required` - Whether Redis is required (`REQUIRE_REDIS` flag)
  - `auth.enabled` - Auth system status
  - Disconnect duration (if disconnected)

### 3. Environment Flag: `REQUIRE_REDIS`

**Usage**:
```env
REQUIRE_REDIS=true   # Multi-instance mode (Redis required)
REQUIRE_REDIS=false  # Single-instance mode (Redis optional)
```

**Behavior**:
- If `true` and Redis down → `/health/ready` returns 503
- If `false` → App runs in fallback mode, `/health/ready` still 200

### 4. Adapter Lifecycle Improvements

**Guards**:
- Only attach adapter when **both clients are READY**
- Prevent double-attachment (checked via `adapterAttached` flag)
- Re-attach automatically on Redis reconnect

**Logging**:
- Single warning per boot if Redis unavailable
- Clear status on reconnect

## Why Upstash Redis Flaps

**This is normal behavior:**
- Upstash uses serverless architecture
- Connections may drop during scaling/rebalancing
- TLS connections can timeout during idle periods
- Built-in reconnect handles this automatically

**Our approach:**
- Accept that disconnects happen
- Log them appropriately (WARN, not ERROR)
- Track downtime for monitoring
- Ensure app continues working (fallback mode)

## Verification Checklist

✅ App starts even if Redis is temporarily down  
✅ Redis reconnect does NOT require app restart  
✅ `/health/live` always returns 200  
✅ `/health/ready` accurately reflects Redis state  
✅ Multi-instance works when Redis is ready  
✅ No blocking I/O  
✅ No log spam during reconnects  

## Production Deployment Notes

**Render Configuration**:
- Set healthcheck to `/health/live` (not `/health/ready`)
- Add `REQUIRE_REDIS=true` to production environment

**Upstash**:
- Expect occasional "Socket closed" messages
- Downtime < 5s is normal
- Downtime > 30s should trigger alerts

## Testing Locally

1. Start server: `npm start`
2. Check health:
   ```bash
   curl http://localhost:3000/health/live   # Should always be 200
   curl http://localhost:3000/health/ready  # 200 if Redis OK, 503 if down
   ```
3. Stop Redis (if local): Health ready should fail if REQUIRE_REDIS=true
4. Restart Redis: Adapter should re-attach automatically
