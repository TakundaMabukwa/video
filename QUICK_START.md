# Quick Start - Live Video Streaming

## ✅ Fixed Issues:
1. ✅ WebSocket connection - Now uses dynamic host/port
2. ✅ Auto-discovery - Vehicles load automatically every 5 seconds
3. ✅ Multi-channel - Click any channel button to start/stop
4. ✅ Start All - One button to stream all channels

## 🚀 Start Server:
```bash
npm run build
npm start
```

## 📺 Open Browser:
```
http://localhost:3000/live-stream.html
```

## 🎯 What You'll See:

### 1. Connection Status (Top):
- ✅ Green = Connected to WebSocket
- ❌ Red = Disconnected (auto-reconnects)

### 2. Connected Vehicles Section:
```
🚗 013912345678
   4 channels | Active: 0
   [▶️ Start All] [⏹️ Stop All]
   [Ch 1] [Ch 2] [Ch 3] [Ch 4]
```

### 3. How to Stream:

**Option A - Single Channel:**
- Click any `[Ch X]` button
- Button turns green with ✓
- Video card appears below

**Option B - All Channels:**
- Click `[▶️ Start All]`
- All 4 channels start streaming
- 4 video cards appear

**Stop Streaming:**
- Click green `[Ch X ✓]` button again
- Or click `[⏹️ Stop All]`

## 📊 Video Cards Show:
```
🚗 013912345678 - Channel 1
[Video Canvas - Shows frame info]
Frames: 1234 | I-Frames: 45
Rate: 850 KB/s | Last: 10:30:45
```

## 🔄 Auto-Refresh:
- Vehicles list refreshes every 5 seconds
- New vehicles appear automatically
- Disconnected vehicles fade out

## 🐛 Troubleshooting:

### "Not connected to server"
1. Check server is running: `npm start`
2. Check console for errors (F12)
3. Verify WebSocket URL in console

### No vehicles showing
1. Check camera is connected to TCP 7611
2. Look at server logs for authentication
3. Click `[🔄 Refresh]` button

### Channels not starting
1. Check server logs for 0x9101 command
2. Verify camera supports the channel
3. Try one channel at a time first

## 📝 Server Logs to Watch:
```
✅ Camera authenticated: 013912345678
🔍 Querying capabilities...
📊 Max video channels: 4
Video stream client connected
Started video stream: 013912345678_1
📡 Sending 0x9101: TCP=7611, UDP=6611, Channel=1
Processed 500 packets in last 5s
Broadcast I-frame to 1 clients: 013912345678_1
```

## ✅ Success Indicators:
- Green channel buttons with ✓
- Video cards showing frame counts
- Increasing frame numbers
- I-frame count growing
- Data rate showing KB/s

## 🎬 Next Steps:
1. Start with 1 channel to verify
2. Then try "Start All" for multi-view
3. Check frame rates (should be 15-30 fps)
4. Monitor data rates (500KB-2MB/s per channel)

## 🔧 API Endpoints:
```bash
# Get connected vehicles
curl http://localhost:3000/api/vehicles/connected

# Get stream stats
curl http://localhost:3000/api/stream/stats

# Health check
curl http://localhost:3000/health
```

## 📱 Features:
- ✅ Auto-discovery of vehicles
- ✅ Per-channel control
- ✅ Multi-channel streaming
- ✅ Real-time frame display
- ✅ Bandwidth monitoring
- ✅ I-frame detection
- ✅ Auto-reconnect
- ✅ 5-second refresh

Ready to stream! 🎥
