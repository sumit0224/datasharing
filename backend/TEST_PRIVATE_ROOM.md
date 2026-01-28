# Private Room Expiry Test Plan

## 🐛 Issue Fixed
Private rooms were expiring immediately upon creation instead of respecting the configured expiry time.

## 🔧 Root Causes Identified & Fixed

### 1. Type Coercion Issue
**Problem**: `expiresIn` was being treated as a string in some cases, causing incorrect time calculations.

**Fix**: Added explicit `Number()` parsing with validation:
```javascript
const minutes = Number(expiresIn);
if (!isNaN(minutes) && minutes > 0) {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    // ...
}
```

### 2. Redis Metadata Loss During Cleanup
**Problem**: When Redis had brief connection issues, `getRoomMeta()` could return `null`, causing the cleanup job to treat private rooms as public and delete them from the cache.

**Fix**: Added safety check based on room ID prefix:
```javascript
if (!meta && roomId.startsWith('private-')) {
    // Skip cleanup - Redis metadata temporarily unavailable
}
```

## ✅ Verification Steps

### Manual Testing
1. **Create a Private Room**
   - Open the app: http://localhost:5173
   - Click "New Room"
   - Toggle "Private Room" ON
   - Set password (min 6 chars)
   - Choose expiry: **10 Minutes**
   - Create the room

2. **Verify Room Stays Active**
   - Send a text message immediately
   - Wait 1-2 minutes
   - **Expected**: Room still accessible, messages visible
   - **Previously**: Room would expire/close within seconds

3. **Check Logs**
   - Look for: `Creating Private Room private-... with Expiry: ...`
   - The timestamp should be ~10 minutes in the future (not in the past)

4. **Test Actual Expiry**
   - Wait for the full expiry time (10 min)
   - The cleanup job runs every 30 seconds
   - **Expected**: Room closes with `room_closed` event after true expiry

### Expected Log Output
```
info: Creating Private Room private-lxyz123 with Expiry: 2026-01-28T18:11:33.987Z (in 10 mins)
```

## 🚀 Changes Applied
- `server.js:486-493`: Number validation for expiresIn
- `server.js:914-924`: Private room metadata safety guard
