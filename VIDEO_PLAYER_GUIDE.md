# Video Player Options - Quick Guide

## 🎯 RECOMMENDED: HLS Player (Best Quality)

**URL**: `http://164.90.182.2:3000/hls-player.html`

**Features**:
- ✅ Actual video playback (not just frame indicators)
- ✅ Uses HLS (HTTP Live Streaming) - industry standard
- ✅ Works in all modern browsers
- ✅ Automatic buffering and quality adjustment
- ✅ Supports multiple cameras simultaneously
- ✅ Play/pause/seek controls

**How it works**:
1. Server receives H.264 frames from cameras
2. FFmpeg converts frames to HLS segments (.ts files)
3. Browser plays HLS stream using hls.js library
4. Smooth, continuous video playback

**Requirements**:
- FFmpeg must be installed on server
- HLS segments generated in `/hls` directory
- Cameras must be streaming

---

## 📊 Frame Indicator Players (For Testing)

### 1. Motion JPEG Player
**URL**: `http://164.90.182.2:3000/mjpeg-player.html`

Shows frame activity with visual indicators:
- 🎬 I-FRAME (green) - Key frames
- 📹 P-FRAME (gray) - Predicted frames
- Frame count, FPS, vehicle ID

**Use for**: Verifying frames are being received

### 2. WebSocket Player
**URL**: `http://164.90.182.2:3000/ws-video-player.html`

Same as Motion JPEG but uses WebSocket instead of SSE.

### 3. SSE Viewer (Original)
**URL**: `http://164.90.182.2:3000/sse-viewer.html`

Text-based log showing frame reception.

---

## 🔧 Why You're Not Seeing Video

Your current viewer (`sse-viewer.html`) shows:
```
Status: Streaming | Frames: 26 | I-Frames: 2
```

This means:
- ✅ Frames ARE being received
- ✅ Server IS working correctly
- ❌ But you're only seeing LOGS, not VIDEO

**The issue**: Raw H.264 frames can't be displayed directly in HTML. You need:
1. **HLS Player** - Converts H.264 to HLS format (RECOMMENDED)
2. **H.264 Decoder** - JavaScript decoder (complex, slower)
3. **WebRTC** - Real-time protocol (requires STUN/TURN server)

---

## 🚀 Quick Start - See Video NOW

### Option 1: HLS Player (Best)

1. **Check FFmpeg is installed**:
   ```bash
   ffmpeg -version
   ```

2. **Restart server** (to enable HLS):
   ```bash
   npm run build
   npm start
   ```

3. **Open HLS player**:
   ```
   http://164.90.182.2:3000/hls-player.html
   ```

4. **Click "Refresh Vehicles"** - Should show connected cameras

5. **Video should start playing automatically**

### Option 2: Frame Indicator (Quick Test)

1. **Open Motion JPEG player**:
   ```
   http://164.90.182.2:3000/mjpeg-player.html
   ```

2. **You'll see**:
   - Frame indicators updating in real-time
   - FPS counter
   - I-frame vs P-frame visualization

---

## 📁 File Locations

```
public/
├── hls-player.html          ← RECOMMENDED (actual video)
├── mjpeg-player.html         ← Frame indicators
├── ws-video-player.html      ← WebSocket version
├── video-player.html         ← Broadway.js decoder (experimental)
└── sse-viewer.html           ← Text logs only (current)

hls/
└── {vehicleId}/
    └── channel_{N}/
        ├── playlist.m3u8     ← HLS playlist
        └── segment*.ts       ← Video segments
```

---

## 🔍 Troubleshooting

### "No video showing in HLS player"

**Check**:
1. FFmpeg installed: `ffmpeg -version`
2. HLS directory exists: `ls hls/`
3. Playlist generated: `ls hls/*/channel_*/playlist.m3u8`
4. Browser console for errors (F12)

**Fix**:
```bash
# Install FFmpeg (Ubuntu/Debian)
sudo apt-get install ffmpeg

# Or (CentOS/RHEL)
sudo yum install ffmpeg

# Restart server
pm2 restart video-server
```

### "Frame indicators working but want actual video"

Use HLS player - it's the only way to get smooth video playback in browser.

### "HLS player shows 'Loading...' forever"

**Possible causes**:
1. FFmpeg not generating segments
2. Camera not streaming
3. Wrong URL path

**Check logs**:
```bash
pm2 logs video-server | grep -i hls
```

---

## 📊 Comparison

| Player | Video Quality | Latency | Browser Support | Complexity |
|--------|--------------|---------|-----------------|------------|
| **HLS** | ⭐⭐⭐⭐⭐ | 2-5s | ⭐⭐⭐⭐⭐ | Low |
| **WebRTC** | ⭐⭐⭐⭐⭐ | <1s | ⭐⭐⭐⭐ | High |
| **Broadway.js** | ⭐⭐⭐ | 1-2s | ⭐⭐⭐⭐ | Medium |
| **Frame Indicators** | ⭐ | <1s | ⭐⭐⭐⭐⭐ | Low |

---

## 🎯 Recommendation

**For production use**: `hls-player.html`
- Best quality
- Most reliable
- Works everywhere
- Industry standard

**For testing**: `mjpeg-player.html`
- Quick verification
- Shows frame activity
- No dependencies

**Current viewer** (`sse-viewer.html`):
- Good for debugging
- Shows frame reception
- But NOT for video playback
