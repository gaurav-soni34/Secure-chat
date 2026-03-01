# Cross-Device Deployment Guide

## Issues Found & Fixed

Your application wasn't working across different devices due to multiple configuration issues:

### 1. **SameSite Cookie Policy Too Strict** ❌ → ✅
**Problem:** The authentication cookie was set with `sameSite: "strict"`, which means browsers would NOT send it when accessing from a different device/IP address.

**Fix:** Changed `sameSite: "strict"` to `sameSite: "lax"` in `src/proxy.ts`
- "strict" = cookies only sent to same-site requests (same scheme + domain + port)
- "lax" = cookies sent on same-site requests + top-level navigations (allows cross-device)

### 2. **Missing CORS Configuration** ❌ → ✅
**Problem:** The Elysia API had no CORS headers, causing browsers to block requests from different origins.

**Fix:** Added CORS middleware to `src/app/api/[[...slugs]]/route.ts`
- Allows requests from any origin
- Includes credentials (cookies) in CORS responses
- Handles OPTIONS preflight requests
- Properly sets `Access-Control-Allow-Credentials: true`

### 3. **Client Not Sending Credentials** ❌ → ✅
**Problem:** The API client wasn't configured to send cookies with requests.

**Fix:** Updated `src/lib/client.ts` to include credentials:
```typescript
treaty<App>(apiUrl, {
  fetch: {
    credentials: 'include', // Send cookies with all requests
  }
})
```

### 4. **Missing Environment Configuration** ❌ → ✅
**Problem:** `NEXT_PUBLIC_API_URL` undefined or hardcoded to localhost.

**Fix:** 
- Created proper `NEXT_PUBLIC_API_URL` configuration in `.env.local`
- Made client smart: auto-detects URL from browser in production, falls back to env var
- Supports both localhost and cross-device network URLs

### 5. **No Next.js CORS Headers** ❌ → ✅
**Problem:** Next.js API routes need proper CORS headers configured.

**Fix:** Added CORS and rewrite configuration to `next.config.ts`
- Ensures API routes accept cross-origin requests
- Maintains credentials in CORS responses

---

## Deployment Instructions

### For Local Network Testing (Same WiFi)

1. **Find your machine's local IP:**
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. **Update `.env.local`:**
   ```
   NEXT_PUBLIC_API_URL=http://192.168.1.100:3000
   ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

4. **On other device on same network, visit:**
   ```
   http://192.168.1.100:3000
   ```

---

### For Production Deployment

#### Using Vercel (Recommended)
```bash
# Push to GitHub and deploy with Vercel
# Vercel automatically handles:
# - HTTPS (required for secure cookies)
# - Custom domain
# - Environment variables
```

Update `.env.production.local` or Vercel dashboard with:
```
NEXT_PUBLIC_API_URL=https://yourdomain.vercel.app
```

#### Using Custom Server/Docker

**Key Requirements:**
1. Server **must be accessible** from all intended devices (not localhost:3000)
2. Use **HTTPS in production** (cookies with `secure: true`)
3. Set proper domain for cookies

**Environment Variables (Production):**
```bash
# .env.production.local
NEXT_PUBLIC_API_URL=https://yourdomain.com

# Or for self-hosted:
NEXT_PUBLIC_API_URL=https://your-server-ip-or-domain.com
```

**Docker Example:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t realtime-chat .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://yourdomain.com \
  realtime-chat
```

---

## How It Works Now

### Before (Broken) ❌
```
Device A                          Device B
  ↓                                 ↓
Both access http://localhost  → Only Device A works
                              → Device B can't connect (localhost not accessible)
                              
Same as Device A on mobile   → Mobile gets different origin
  ↓                          → Cookie not sent (sameSite: strict)
API calls fail              → Auth fails
```

### After (Fixed) ✅
```
Device A                          Device B
  ↓                                 ↓
Both access http://192.168.1.100:3000
    ↓                              ↓
    Client sends request with credentials
    ↓
    CORS middleware accepts request
    ↓
    Auth cookie sent and validated ✓
    ↓
    Messages sync in real-time
```

---

## Technical Details

### Cookie Configuration Changes
| Property | Before | After | Reason |
|----------|--------|-------|--------|
| `sameSite` | `"strict"` | `"lax"` | Allow cross-device access |
| `secure` | `NODE_ENV === "production"` | `NODE_ENV === "production"` | HTTPS only in production |
| `httpOnly` | `true` | `true` | Prevent XSS cookie theft |

### CORS Headers Added
```typescript
Access-Control-Allow-Origin: * // or specific domain in production
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, Cookie, x-auth-token
```

### Client-Side Credentials
```typescript
// Before: No credentials sent
treaty<App>(url)

// After: Always send cookies
treaty<App>(url, {
  fetch: {
    credentials: 'include'
  }
})
```

---

## Testing Checklist

- [ ] Create a room on Device A
- [ ] Open the same room link on Device B (different device/IP)
- [ ] Send message from Device A → Appears on Device B ✓
- [ ] Send message from Device B → Appears on Device A ✓
- [ ] Room destruction syncs across devices ✓
- [ ] TTL countdown syncs across devices ✓

---

## Troubleshooting

### Messages still not syncing?

1. **Check Network Accessibility:**
   ```bash
   # From Device B, test if it can reach Device A
   ping 192.168.1.100
   curl http://192.168.1.100:3000
   ```

2. **Check Browser Console:** (F12 → Console)
   - Look for CORS errors
   - Check Network tab for failed API requests
   - Verify cookies are being sent

3. **Rebuild after changing env:**
   ```bash
   npm run build && npm run start
   ```

4. **Check Production HTTPS:**
   - In production, ensure cookies have `secure: true`
   - This requires HTTPS
   - Check if cert is valid

5. **Clear Browser Data:**
   - Clear cookies for the domain
   - Clear site data
   - Hard refresh (Ctrl+Shift+R)

---

## Security Notes

🔒 **This configuration is safe because:**
1. Cookies are `httpOnly` (not accessible to JavaScript)
2. Cookies are `sameSite: lax` (not sent with untrusted requests)
3. Auth token is validated server-side
4. Room access requires valid token + matching user list
5. In production, `secure: true` ensures HTTPS-only transmission

---

## Summary of Changes

### Files Modified:
1. **src/lib/client.ts** - Added credentials support and smart URL detection
2. **src/proxy.ts** - Changed sameSite from "strict" to "lax"
3. **src/app/api/[[...slugs]]/route.ts** - Added CORS middleware
4. **next.config.ts** - Added CORS and rewrite configuration
5. **.env.local** - Added documentation for API URL configuration

### Key Principle:
**Same-device works because user request goes to localhost → server on localhost → session cookie sent back to same origin.**

**Cross-device now works because:**
1. User request goes to IP:3000 from any device
2. CORS allows cross-origin requests
3. Cookie is sent (sameSite: lax)
4. Server validates token
5. User authenticated ✓

---

