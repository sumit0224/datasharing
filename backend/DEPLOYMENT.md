# AirForShare Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
```bash
# Install Redis
brew install redis  # macOS
# OR
sudo apt-get install redis-server  # Ubuntu/Debian

# Install PM2 globally
npm install -g pm2

# Install Nginx (optional - for load balancing)
brew install nginx  # macOS
# OR
sudo apt-get install nginx  # Ubuntu/Debian
```

---

## 📦 Installation

### 1. Clone & Install Dependencies
```bash
cd /path/to/airForShare
npm install
```

### 2. Environment Setup
```bash
# Copy production env template
cp .env.production .env

# Edit .env with your production values
nano .env
```

**Important environment variables:**
- `NODE_ENV=production`
- `REDIS_URL=redis://localhost:6379`
- `CLIENT_URL=https://your-domain.com`

---

## 🔴 Start Redis

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis
sudo systemctl enable redis  # Auto-start on boot

# Verify Redis is running
redis-cli ping
# Should respond: PONG
```

---

## 🚀 Start Application

### Development Mode (Single Instance)
```bash
npm start
```

### Production Mode (PM2 Cluster)
```bash
# Start 4 clustered instances
pm2 start ecosystem.config.js --env production

# View status
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs airforshare

# Stop all
pm2 stop airforshare

# Restart all
pm2 restart airforshare

# Delete from PM2
pm2 delete airforshare
```

---

## 🔄 PM2 Commands Reference

```bash
# Start
pm2 start ecosystem.config.js

# Start with specific number of instances
pm2 start ecosystem.config.js -i 2

# Reload (zero-downtime restart)
pm2 reload airforshare

# Scale up/down
pm2 scale airforshare 6  # Scale to 6 instances

# Save PM2 process list (auto-restart on boot)
pm2 save
pm2 startup  # Follow the instructions

# Monitor CPU/Memory
pm2 monit

# Logs
pm2 logs airforshare --lines 100
pm2 logs airforshare --err  # Error logs only
```

---

## 🌐 Nginx Setup (Optional - for Load Balancing)

### 1. Configure Nginx
```bash
# Copy Nginx config
sudo cp nginx.conf /etc/nginx/sites-available/airforshare

# Create symlink
sudo ln -s /etc/nginx/sites-available/airforshare /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 2. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d airforshare.com -d www.airforshare.com

# Auto-renewal test
sudo certbot renew --dry-run
```

---

## 🔍 Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": 1705920000000,
  "redis": true,
  "environment": "production",
  "version": "2.0.0"
}
```

### PM2 Web Dashboard
```bash
# Install PM2 web interface
pm2 install pm2-server-monit

# Access at: http://localhost:9615
```

---

## 📊 Performance Testing

### Load Testing with Artillery
```bash
# Install Artillery
npm install -g artillery

# Create test script (artillery-test.yml)
cat > artillery-test.yml << EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 50
scenarios:
  - name: "File sharing test"
    flow:
      - get:
          url: "/api/room-info"
      - post:
          url: "/api/upload"
          formData:
            file: "@test-file.jpg"
EOF

# Run test
artillery run artillery-test.yml
```

---

## 🐛 Troubleshooting

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Check Redis logs
tail -f /usr/local/var/log/redis.log  # macOS
tail -f /var/log/redis/redis-server.log  # Linux

# Restart Redis
sudo systemctl restart redis
```

### PM2 Issues
```bash
# View detailed logs
pm2 logs airforshare --lines 500

# Check PM2 process
pm2 describe airforshare

# Flush logs
pm2 flush

# Restart with fresh state
pm2 delete airforshare
pm2 start ecosystem.config.js --env production
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

---

## 📈 Scaling Strategies

### Vertical Scaling (Single Server)
```bash
# Increase PM2 instances to match CPU cores
pm2 scale airforshare max

# Increase memory limit
# Edit ecosystem.config.js: max_memory_restart: '1G'
pm2 reload airforshare
```

### Horizontal Scaling (Multiple Servers)
1. Deploy to multiple servers
2. Use external Redis server (Redis Cloud/ElastiCache)
3. Configure Nginx to balance across servers
4. Use shared file storage (NFS/S3)

**Example Nginx config for multiple servers:**
```nginx
upstream airforshare_backend {
    server server1.example.com:3000;
    server server2.example.com:3000;
    server server3.example.com:3000;
}
```

---

## 🔒 Security Checklist

- [ ] Redis password enabled (`requirepass` in redis.conf)
- [ ] Firewall configured (allow only 80, 443, SSH)
- [ ] SSL certificate installed and auto-renewing
- [ ] Environment variables secured (no hardcoded secrets)
- [ ] Rate limiting enabled (default: 100 req/15min)
- [ ] Helmet.js headers active
- [ ] File upload limits enforced (100MB)
- [ ] CORS properly configured
- [ ] Logs being rotated (logrotate)

---

## 📝 Maintenance

### Log Rotation
```bash
# Create logrotate config
sudo nano /etc/logrotate.d/airforshare

# Add:
/path/to/airForShare/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Backup Strategy
```bash
# Backup Redis data
redis-cli bgsave

# Backup uploaded files
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Automated backup script (cron)
0 2 * * * /path/to/backup-script.sh
```

---

## 🎯 Production Checklist

- [ ] Redis installed and running
- [ ] PM2 installed globally
- [ ] Production env variables configured
- [ ] PM2 started with ecosystem.config.js
- [ ] PM2 saved and startup configured
- [ ] Nginx installed and configured (if using)
- [ ] SSL certificates installed
- [ ] Health endpoint responding
- [ ] Logs directory created and writable
- [ ] File uploads tested
- [ ] Socket.IO connections working
- [ ] Rate limiting tested
- [ ] Auto-cleanup running (check logs)
- [ ] Monitoring setup complete

---

## ✅ Success Indicators

Your deployment is successful when:
1. `pm2 status` shows 4 instances "online"
2. `/health` endpoint returns `"status": "ok"`
3. Redis connection shows `"redis": true`
4. Clients can connect via Socket.IO
5. File uploads work across all instances
6. Logs show no errors
7. CPU usage distributed across cores

---

## 📞 Support

For issues or questions, check:
- Application logs: `pm2 logs airforshare`
- Nginx logs: `/var/log/nginx/airforshare-error.log`
- Redis logs: `/var/log/redis/redis-server.log`
- Health endpoint: `curl http://localhost:3000/health`
