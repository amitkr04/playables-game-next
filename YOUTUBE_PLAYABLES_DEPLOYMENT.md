# YouTube Playables Deployment Guide

## 🚀 Deployment Steps

### Step 1: Build for Production

```bash
npm run build
```

This creates the `out/` folder with your static game.

### Step 2: Apply Path Fixes

```bash
node scripts/fix-export.cjs
```

This ensures all paths are correct for file:// access.

### Step 3: Verify Local Build Works

Open `out/index.html` in a browser to test locally:

- ✅ Game should load without 404 errors
- ✅ Console should show SDK initialization messages
- ✅ No MIME type errors for CSS/JS files

---

## ❌ Errors on YouTube Playables & Solutions

### Error 1: "Refused to apply style because its MIME type is 'text/html'"

**Cause:** YouTube Playables isn't serving CSS files with correct `Content-Type: text/css` header.

**Solution:**

- Ensure your upload process preserves file MIME types
- Check YouTube Playables upload settings for "Preserve file types"
- Verify server configuration uses proper MIME type mapping

### Error 2: "Failed to load resource: 404"

**Cause:** Static assets (CSS, JS chunks) aren't being served from the correct path.

**Solution:**

1. When uploading to YouTube Playables, upload the **entire `out/` folder** (including all subdirectories)
2. Ensure the directory structure is preserved:
   ```
   index.html
   _next/
     static/
       css/
       js/
       chunks/
       media/
   favicon.ico
   ```
3. Do NOT flatten the directory structure

### Error 3: "An iframe which has both allow-scripts and allow-same-origin can escape its sandboxing"

**Cause:** Security warning from YouTube SDK running in a restricted iframe.

**Solution:**

- This is a **warning, not a critical error**
- YouTube Playables SDK runs in a sandbox for security
- Your code already handles this correctly in `src/app/spin-match/youtubeSdk.js`
- No action needed on your side

---

## 📋 YouTube Playables Requirements Checklist

Before uploading, verify:

- [ ] **SDK Initialization**: SDK loaded before game code ✅ (See `Gamewrapper.jsx`)
- [ ] **firstFrameReady**: Called during SDK init ✅ (Line 81 in `youtubeSdk.js`)
- [ ] **gameReady**: Called after loading screen ✅ (Line 38-42 in `Gamewrapper.jsx`)
- [ ] **Bundle Size**: < 30 MiB ✅ (Next.js auto-optimizes)
- [ ] **Save Data Size**: < 3 MiB ✅ (Validated in `youtubeSdk.js`)
- [ ] **Cloud Save API**: Used instead of localStorage ✅ (Migrated)
- [ ] **No localStorage/sessionStorage**: Cloud save only ⚠️ (Exception: tutorial completion)

---

## 🔧 Upload Configuration for YouTube Playables

### Using YouTube Developer Portal

1. Go to: https://developers.google.com/youtube/gaming/playables/developer_portal

2. Create/Select your game

3. Upload game files:
   - **Method**: Upload entire `out/` folder as ZIP
   - **File Structure**: Keep original directory structure
   - **Entry Point**: `index.html`

4. Configure MIME types:
   - `.css` → `text/css`
   - `.js` → `application/javascript`
   - `.woff2` → `font/woff2`
   - `.json` → `application/json`

5. Set HTTP Headers:
   ```
   Content-Type: text/html; charset=utf-8
   X-Content-Type-Options: nosniff
   Cache-Control: public, max-age=3600
   ```

### Alternative: Custom Server Configuration

If using a custom server instead of YouTube's hosting:

```nginx
# nginx example
location /_next/static/css/ {
    add_header Content-Type text/css;
    add_header Cache-Control "public, max-age=31536000";
}

location /_next/static/chunks/ {
    add_header Content-Type application/javascript;
    add_header Cache-Control "public, max-age=31536000";
}

location /_next/static/media/ {
    add_header Cache-Control "public, max-age=31536000";
}
```

---

## 🧪 Testing Checklist

### Local Testing (file://)

```bash
npm run build
node scripts/fix-export.cjs
# Open out/index.html in browser
```

### Remote Testing (via YouTube Playables)

1. Upload to YouTube Playables test environment
2. Check browser console for:
   - ❌ 404 errors → Fix asset paths
   - ❌ MIME type errors → Fix server config
   - ✅ SDK initialization logs
   - ✅ Game ready message

### Console Should Show:

```
[GameWrapper] Initializing YouTube SDK...
[YouTube SDK] Initializing...
[YouTube SDK] Audio enabled: true
[YouTube SDK] firstFrameReady called
(No 404 errors)
(No MIME type errors)
```

---

## 📞 Debug Tips

### Check Network Tab in DevTools

1. Open YouTube Playables in browser
2. Right-click → Inspect → Network tab
3. Look at failed requests:
   - If returning HTML (status 200), MIME type is wrong
   - If returning 404, path is incorrect

### Check Response Headers

For CSS file, should show:

```
Content-Type: text/css
Content-Length: 12345
```

For JS file, should show:

```
Content-Type: application/javascript
Content-Length: 54321
```

---

## ✅ Verification Script

Run this to verify your build is ready:

```bash
npm run build
node scripts/fix-export.cjs

# Check output folder structure
ls -R out/
```

Should contain:

```
out/
├── index.html
├── favicon.ico
└── _next/
    └── static/
        ├── css/
        ├── chunks/
        ├── media/
        └── ...
```

---

## 🎮 Game Features Status

| Feature         | Status         | Notes                            |
| --------------- | -------------- | -------------------------------- |
| SDK Integration | ✅ Complete    | YouTube Playables v1 API         |
| Cloud Save      | ✅ Implemented | Replaces localStorage            |
| Leaderboard     | ✅ Ready       | Via `sendScore()`                |
| Audio Control   | ✅ Working     | Toggleable setting               |
| 3D Game         | ✅ Optimized   | Three.js with auto-optimization  |
| Tutorial        | ✅ Included    | Device-specific (sessionStorage) |
| Localization    | ✅ Working     | English & Hindi                  |

---

## 📚 References

- [YouTube Playables Getting Started](https://developers.google.com/youtube/gaming/playables/reference/getting_started)
- [YouTube Playables Test Suite](https://developers.google.com/youtube/gaming/playables/test_suite)
- [YouTube Playables Certification Requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements)
- [Developer Portal](https://developers.google.com/youtube/gaming/playables/developer_portal)
