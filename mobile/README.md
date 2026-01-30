# WiFi Share - React Native Mobile App

A cross-platform mobile app for WiFi-based file and text sharing built with React Native and Expo.

## Features

✅ **Real-time text sharing** with 10-minute auto-expiry  
✅ **File upload/download** with 2-minute auto-expiry  
✅ **Automatic room joining** based on WiFi network  
✅ **Live user presence** tracking  
✅ **Cross-platform** (iOS & Android)  
✅ **No login required** - guest-based system

---

## Prerequisites

- Node.js (v16+)
- Expo CLI: `npm install -g expo-cli`
- **For iOS**: Expo Go app or Xcode
- **For Android**: Expo Go app or Android Studio

---

## Quick Start

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure Backend URL

For testing on a physical device, update the API URL in `src/services/api.js`:

```javascript
const API_URL = __DEV__ 
  ? 'http://YOUR_COMPUTER_IP:3000'  // Replace with your machine's IP
  : 'https://your-production-url.com';
```

**Find your IP address:**
- **Mac**: `ipconfig getifaddr en0`
- **Windows**: `ipconfig` (look for IPv4)
- **Linux**: `ifconfig` or `ip addr`

### 3. Start the App

```bash
npx expo start
```

### 4. Run on Device/Emulator

**Option A: Physical Device (Recommended)**
1. Install **Expo Go** app from App Store/Play Store
2. Scan the QR code from the terminal
3. Make sure device is on **same WiFi** as your dev machine

**Option B: iOS Simulator**
```bash
Press 'i' in the terminal
```

**Option C: Android Emulator**
```bash
Press 'a' in the terminal
```

---

## Testing with Web App

1. Start backend server: `cd backend && npm start`
2. Start web app: `cd client && npm run dev`
3. Start mobile app: `cd mobile && npx expo start`
4. Upload a file from mobile → should appear on web instantly
5. Send text from web → should appear on mobile instantly
6. Wait 2 minutes → files auto-delete
7. Wait 10 minutes → texts auto-delete

---

## Project Structure

```
mobile/
├── App.js                      # Entry point
├── src/
│   ├── screens/
│   │   └── HomeScreen.js       # Main screen with tabs
│   ├── components/
│   │   ├── TextShare.js        # Text messaging UI
│   │   ├── FileShare.js        # File upload/download UI
│   │   ├── RoomInfo.js         # Room header
│   │   └── ConnectionStatus.js # Socket status indicator
│   ├── services/
│   │   ├── socket.js           # Socket.IO client
│   │   └── api.js              # Axios HTTP client
│   └── utils/
│       └── identity.js         # Device ID generation
```

---

## Features Overview

### Text Sharing
- Send and receive messages in real-time
- Copy text to clipboard (tap message)
- Delete messages instantly
- Auto-delete after 10 minutes
- Different messages for automatic vs manual deletion

### File Sharing
- Pick files from device storage
- Upload to cloud (Cloudflare R2)
- Download and share files
- Auto-delete after 2 minutes
- Toast notifications for all events

### Real-time Updates
- Socket.IO for instant synchronization
- User count updates live
- Automatic reconnection on network issues
- Connection status indicator

---

## Building for Production

### iOS

```bash
expo build:ios
```

### Android

```bash
expo build:android
```

Or use EAS Build (recommended):

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

---

## Troubleshooting

### "Cannot connect to server"

1. Check backend is running on port 3000
2. Verify CORS is enabled in backend (`origin: '*'`)
3. On physical device, use your computer's IP instead of localhost
4. Ensure device and computer are on same WiFi

### "File upload failed"

1. Check Android permissions in `app.json`
2. Verify backend file size limits
3. Check network connectivity
4. Look at backend logs for errors

### "Socket disconnects frequently"

1. Check WiFi stability
2. Increase `pingTimeout` in socket config
3. Verify backend is not rate-limiting

---

## Environment Variables

For production, create `.env` file:

```env
API_URL=https://your-backend-url.com
```

Then update `src/services/api.js` to use environment variables.

---

## Known Limitations

- Files limited to 100MB (backend setting)
- Only one room per WiFi network
- No end-to-end encryption
- Texts expire after 10 min, files after 2 min

---

## Next Steps

- [ ] Add push notifications for file shares
- [ ] Implement file preview
- [ ] Add countdown timers for expiry
- [ ] E2E encryption
- [ ] Custom room creation from mobile

---

## License

MIT
