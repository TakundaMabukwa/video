# Video Streaming and 30-Second Pre/Post Event Capture Documentation

## Overview
This document summarizes the architecture, changes, and testing instructions for the video streaming and alert-based 30-second pre/post event video capture system, as discussed and implemented in this session.

---

## 1. System Architecture

### Video Flow (TCP Only)
```
Camera (TCP 7611)
   │
   ▼ RTP packets (0x30316364)
TCP Server (handleRTPData)
   │
   ▼
TCPRTPHandler (FrameAssembler)
   │
   ├─ HLSStreamer (FFmpeg → HLS)
   ├─ VideoWriter (.h264 files)
   └─ AlertManager (CircularVideoBuffer)
         │
         ▼
   30-second rolling buffer (per vehicle/channel)
         │
         ▼
   On alert: captureEventClip()
         │
         ├─ Pre-event: save last 30s immediately
         └─ Post-event: record next 30s, then save
```

### HLS Player
- `/hls-player.html` uses HLS.js to play `/hls/{vehicleId}/channel_{N}/playlist.m3u8`.
- Streams are generated from live TCP video using FFmpeg.

---

## 2. Key Code Changes

### a. TCPRTPHandler Integration
- Now calls `alertManager.addFrameToBuffer()` for every complete frame.
- Ensures the circular buffer is filled for TCP-only video streams.

### b. AlertManager Buffer Auto-Init
- `addFrameToBuffer()` auto-initializes the buffer if it doesn't exist.
- Ensures video is always captured, even if `startVideo` wasn't called.

### c. CircularVideoBuffer
- Maintains a rolling 30s buffer per vehicle/channel.
- On alert:
  - Pre-event: saves last 30s of frames immediately.
  - Post-event: records next 30s, then saves.
- Emits events to update alert metadata with video paths.

### d. API Endpoints
- `/api/buffers/status` — Check buffer status for all streams.
- `/api/test/simulate-alert` — Simulate an alert and trigger video capture.
- `/api/alerts/:id/video/pre` — Download pre-event video.
- `/api/alerts/:id/video/post` — Download post-event video.

---

## 3. How to Test

1. **Check buffer status:**
   ```bash
   curl http://localhost:3000/api/buffers/status
   ```
   - Should show ~30s buffer for each active stream.

2. **Simulate an alert:**
   ```bash
   curl -X POST http://localhost:3000/api/test/simulate-alert \
     -H "Content-Type: application/json" \
     -d '{"vehicleId": "YOUR_VEHICLE_ID", "channel": 1, "alertType": "fatigue", "fatigueLevel": 90}'
   ```
   - Pre-event video is saved immediately.
   - Post-event video is saved after ~35s.

3. **Check for video files:**
   ```bash
   ls -la recordings/YOUR_VEHICLE_ID/alerts/
   ```
   - Should see `ALT-xxx_ch1_pre_xxx.h264` and `ALT-xxx_ch1_post_xxx.h264`.

4. **Download video clips:**
   ```bash
   curl http://localhost:3000/api/alerts/ALT-xxx/video/pre -o pre_event.h264
   curl http://localhost:3000/api/alerts/ALT-xxx/video/post -o post_event.h264
   ```

---

## 4. HLS Streaming (Live Only)
- HLS segments are generated from live video using FFmpeg.
- Not suitable for 30s pre/post event capture (segments are 2-5s, rolling window).
- Use the circular buffer for alert-based video capture.

---

## 5. Summary of Improvements
- **TCP-only streaming now supports 30s pre/post event capture.**
- **No dependency on UDP or explicit startVideo calls.**
- **Buffer auto-initializes as soon as frames arrive.**
- **API endpoints for testing and video retrieval.**

---

## 6. References
- `src/tcp/rtpHandler.ts` — TCP frame handling and buffer integration
- `src/alerts/alertManager.ts` — Buffer management and alert processing
- `src/alerts/circularBuffer.ts` — Rolling buffer and video clip logic
- `src/api/routes.ts` — API endpoints for testing and status
- `public/hls-player.html` — HLS live video player

---

For any further questions, see the code comments or ask for a specific file's logic.
