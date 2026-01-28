# Matchingo - Wi-Fi Based Data & File Sharing

Matchingo is a modern, light-themed web application that allows users on the same Wi-Fi network to share text and files instantly without any login or setup.

## 📋 Requirements

To run this project locally or in production, you need:
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Redis**: v6.x or higher (Required for Room state management and Socket.IO scaling)
- **Docker** (Optional): For containerized deployment

---

## ⚙️ Environment Setup

Matchingo requires specific environment variables to function correctly. Follow these steps to set them up:

### 1. Root Directory
Create a `.env` file in the root directory (optional, used by root scripts):
```env
PORT=3000
NODE_ENV=development
```

### 2. Backend Directory (`/backend`)
Create a `.env` file in the `backend/` folder:
```env
PORT=3000
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
NODE_ENV=development
```
> [!TIP]
> **Redis Token/Password**: If your Redis requires a password (common in cloud providers like Render or Upstash), use this format:
> `REDIS_URL=redis://:your_password@your_host:your_port`


### 3. Client Directory (`/client`)
Create a `.env` file in the `client/` folder:
```env
VITE_API_URL=http://localhost:3000
```

---

## ⚡ Quick Start

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Start the development servers:**
   ```bash
   npm run dev
   ```

3. **Access the app:**
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏗 Architecture

### Technical Highlights
- **State-Aware Redis**: Built on a resilient singleton pattern that gates all operations behind connection health checks. Supports Upstash TLS out of the box.
- **Unique Presence**: Uses Redis Sets to track unique `deviceId`s. Opening 10 tabs in the same browser will correctly show as only 1 online user.
- **Graceful Degradation**: Automatically falls back to in-memory Maps and single-instance mode if Redis goes offline.

### Room Logic
- **IP Detection**: detects client's IP address.
- **Room ID Generation**: First 3 octets of IP → `room-192-168-1`.
- **Localhost Handling**: Falls back to `local-room` for 127.0.0.1.
- **Automatic Joining**: Users on the same network join the same room automatically.

---

## 📦 Folder Structure
```
matchingo/
├── backend/            # Express server & logic
├── client/             # React (Vite) frontend
├── .github/workflows/  # CI/CD pipelines
├── package.json        # Global scripts
└── docker-compose.yml   # Local orchestration
```

---

## ✅ Features

- [x] IP-based automatic room joining
- [x] Real-time text & file sharing
- [x] Unique Device Tracking (1 user = 1 device)
- [x] Production-ready with "State-Aware" Redis Singleton
- [x] Docker & CI/CD support
- [x] Render-ready with ephemeral disk persistence strategy
- [x] Mobile-responsive minimalist UI

---

## 🛡️ Security & Optimization

- **Helmet**: Security headers for protection.
- **Rate Limiting**: Protects APIs from abuse.
- **Compression**: Gzip enabled for faster responses.
- **Auto-Cleanup**: Texts (10min) and Files (2min) are automatically purged.

---

Made with ❤️ by sumit gautam
