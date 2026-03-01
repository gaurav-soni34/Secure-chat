# Environment Variables Configuration

## Development Setup

### For Same-Device Access (Localhost)
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### For Local Network Access (Multiple Devices)

1. Find your machine's IP:
```bash
# Windows
ipconfig
# Look for IPv4 Address like: 192.168.1.100

# macOS/Linux
ifconfig
# or
hostname -I
```

2. Update `.env.local`:
```bash
# Replace 192.168.1.100 with YOUR machine's IP
NEXT_PUBLIC_API_URL=http://192.168.1.100:3000
```

3. Rebuild:
```bash
npm run build
npm run start
```

4. Access from another device on same network:
```
http://192.168.1.100:3000
```

---

## Production Deployment Guide

### Vercel Deployment (Easiest)

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://yourdomain.vercel.app
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Self-Hosted Deployment

#### Option 1: Docker on Linux Server

```bash
# 1. Prepare .env.production.local on your server
NEXT_PUBLIC_API_URL=https://yourdomain.com
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# 2. Build Docker image
docker build -t realtime-chat .

# 3. Run with environment variables
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://yourdomain.com \
  -e UPSTASH_REDIS_REST_URL=your_redis_url \
  -e UPSTASH_REDIS_REST_TOKEN=your_redis_token \
  --name chat-app \
  realtime-chat
```

#### Option 2: Direct Node.js on Server

```bash
# 1. SSH into server
ssh user@yourserver.com

# 2. Clone repository
git clone https://github.com/yourusername/realtime-chat.git
cd realtime-chat

# 3. Create .env.production.local
cat > .env.production.local << EOF
NEXT_PUBLIC_API_URL=https://yourdomain.com
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
EOF

# 4. Install and build
npm ci
npm run build

# 5. Start with PM2 (recommended)
npm install -g pm2
pm2 start npm --name "chat" -- start
pm2 save
pm2 startup

# Or start directly
npm start
```

#### Option 3: Railway, Render, Fly.io

These platforms auto-detect Next.js. Set environment variables in their dashboards:
- `NEXT_PUBLIC_API_URL=https://your-app-name.platform.com`
- Redis credentials

---

## Environment Variable Breakdown

| Variable | Purpose | Example | Where to Set |
|----------|---------|---------|--------------|
| `NEXT_PUBLIC_API_URL` | API base URL for frontend requests | `http://192.168.1.100:3000` or `https://yourdomain.com` | `.env.local` (dev) or platform (prod) |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | `https://optimal-grizzly-16154.upstash.io` | `.env.local` & platform |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication token | `AT8...` | `.env.local` & platform |
| `NODE_ENV` | Environment mode (auto-set by framework) | `production` or `development` | Framework handles |

---

## Auto-URL Detection (Client-Side Logic)

The client now intelligently detects the API URL:

```typescript
// In production (browser): http://yourdomain.com → uses yourdomain.com
// In development (browser): http://localhost:3000 → uses localhost:3000
// Server-side fallback: uses NEXT_PUBLIC_API_URL
```

This means:
- ✓ Works on custom domains automatically
- ✓ Works on IP addresses automatically  
- ✓ Works on localhost in development
- ✓ No need to update for every deployment

---

## CORS & Cookie Security Matrix

|  | Same Machine | Same Network | Cross-Device HTTPS | Notes |
|---|---|---|---|---|
| **sameSite: strict** | ✓ | ✗ | ✗ | Only works on exact same machine |
| **sameSite: lax** | ✓ | ✓ | ✓ | Standard for most apps (FIX APPLIED) |
| **sameSite: none** + secure | ✓ | ✓ | ⚠️ | Only with HTTPS, risky |

Current config: `sameSite: "lax"` ✓ (FIXED)

---

## Testing Environment Setup

### Local Network Testing Checklist

```bash
# 1. Find your IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# 2. Update .env.local
NEXT_PUBLIC_API_URL=http://YOUR_IP:3000

# 3. Build
npm run build

# 4. Start
npm start

# 5. On same device: http://localhost:3000 ✓
# 6. On other device: http://YOUR_IP:3000 ✓
```

### Production Testing Checklist

```bash
# 1. Set production domain
NEXT_PUBLIC_API_URL=https://yourdomain.com

# 2. Enable HTTPS (required for secure cookies)
# Use Let's Encrypt (free) via Nginx/Apache

# 3. Build for production
npm run build

# 4. Test from multiple devices
# Desktop: https://yourdomain.com ✓
# Mobile: https://yourdomain.com ✓
```

---

## Troubleshooting

### 401 Unauthorized on Different Device

**Cause:** Cookie not being sent or sameSite blocking it

**Solution:**
```bash
# Verify sameSite is "lax" in src/proxy.ts
# Verify credentials: 'include' in src/lib/client.ts
# Clear browser cookies and retry
```

### CORS Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** CORS middleware not running

**Solution:**
```bash
# 1. Verify corsMiddleware in route.ts
# 2. Rebuild: npm run build
# 3. Restart server
```

### 404 API Not Found

**Cause:** Wrong NEXT_PUBLIC_API_URL

**Solution:**
```bash
# 1. Check browser console (F12)
# 2. Verify URL is correct
# 3. Test URL directly in browser
curl http://YOUR_IP:3000/api/room/create
```

### Cookies Not Persisting

**Cause:** sameSite too strict, or missing secure flag in production

**Solution:**
```bash
# Development (HTTP): sameSite: "lax" ✓
# Production (HTTPS): sameSite: "lax" + secure: true ✓
```

---

## Production HTTPS Setup

**Required for production reliability:**

```bash
# Using Nginx as reverse proxy

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }
}

# Get free SSL certificate:
sudo apt install certbot nginx python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

