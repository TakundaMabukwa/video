# Persistent Live Video Streaming - JT/T 1078

## ✅ YES - Persistent Streaming is Fully Supported!

According to JT/T 1078 spec section 4.2 and 5.5:
- **TCP connection stays open** for signaling (start/stop commands)
- **UDP receives continuous RTP** as long as stream is active
- **Status notifications (0x9105)** maintain connection health

## 🎥 How It Works

### Architecture:
```
Camera → TCP (7611) → Server → WebSocket → Browser
   ↓
  UDP (6611) → Frame Assembly → H.264 → WebSocket Broadcast
```

### Connection Flow:
1. **Camera connects** via TCP (persistent connection)
2. **Server sends 0x9101** (start video command)
3. **Camera streams RTP** continuously via UDP
4. **Server assembles frames** and broadcasts via WebSocket
5. **Multiple clients** can subscribe to same stream
6. **Stream continues** until explicitly stopped

## 🚀 Usage

### 1. Start Server:
```bash
npm run build
npm start
```

### 2. Open Live Stream Viewer:
```
http://localhost:3000/live-stream.html
```

### 3. Subscribe to Stream:
```javascript
// In browser console or via UI
{
  "type": "subscribe",
  "vehicleId": "013912345678",
  "channel": 1
}
```

### 4. WebSocket API:

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/video');
```

**Subscribe to camera:**
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  vehicleId: '013912345678',
  channel: 1
}));
```

**Receive frames:**
```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'frame') {
    const frame = Buffer.from(msg.data, 'base64');
    const isIFrame = msg.isIFrame;
    // Process H.264 frame
  }
};
```

**Unsubscribe:**
```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  vehicleId: '013912345678',
  channel: 1
}));
```

## 📊 Message Types

### Client → Server:

**Subscribe:**
```json
{
  "type": "subscribe",
  "vehicleId": "013912345678",
  "channel": 1
}
```

**Unsubscribe:**
```json
{
  "type": "unsubscribe",
  "vehicleId": "013912345678",
  "channel": 1
}
```

### Server → Client:

**Subscription Confirmed:**
```json
{
  "type": "subscribed",
  "vehicleId": "013912345678",
  "channel": 1
}
```

**Video Frame:**
```json
{
  "type": "frame",
  "vehicleId": "013912345678",
  "channel": 1,
  "data": "base64_encoded_h264_frame",
  "size": 12345,
  "isIFrame": true,
  "timestamp": 1234567890
}
```

## 🔄 Persistent Connection Features

### 1. **Auto-Reconnect**
- WebSocket auto-reconnects on disconnect
- Streams resume automatically

### 2. **Multi-Client Support**
- Multiple browsers can watch same stream
- Server broadcasts to all subscribers
- No duplicate camera streams

### 3. **Smart Stream Management**
- Stream starts when first client subscribes
- Stream stops when last client unsubscribes
- Automatic cleanup on disconnect

### 4. **Connection Health**
- TCP keepalive (30s)
- WebSocket ping/pong
- Status notifications per spec 5.5.4

## 📈 Performance

### Bandwidth per Stream:
- **720P @ 25fps**: ~1-2 Mbps
- **1080P @ 25fps**: ~2-4 Mbps
- **Multiple channels**: Multiply by channel count

### Latency:
- **Network**: 50-200ms
- **Frame assembly**: 10-50ms
- **WebSocket**: 5-20ms
- **Total**: ~100-300ms end-to-end

## 🎯 Advanced Usage

### Stream Multiple Channels:
```javascript
// Subscribe to all 4 channels
for (let ch = 1; ch <= 4; ch++) {
  ws.send(JSON.stringify({
    type: 'subscribe',
    vehicleId: '013912345678',
    channel: ch
  }));
}
```

### Monitor Stream Stats:
```bash
curl http://localhost:3000/api/stream/stats
```

Response:
```json
{
  "013912345678_1": {
    "subscribers": 2,
    "lastFrame": "2024-01-15T10:30:45.123Z"
  },
  "013912345678_2": {
    "subscribers": 1,
    "lastFrame": "2024-01-15T10:30:45.456Z"
  }
}
```

### Decode H.264 in Browser:
```javascript
// Use Broadway.js or JSMpeg for H.264 decoding
const player = new JSMpeg.Player('ws://localhost:3000/ws/video', {
  canvas: document.getElementById('videoCanvas')
});
```

## 🔧 Configuration

### Environment Variables:
```bash
TCP_PORT=7611        # JT/T 808 signaling
UDP_PORT=6611        # JT/T 1078 RTP video
API_PORT=3000        # HTTP + WebSocket
```

### Adjust Buffer Sizes:
```typescript
// src/udp/frameAssembler.ts
private readonly MAX_BUFFERS = 500;  // Increase for more cameras
private readonly FRAME_TIMEOUT = 5000;  // Frame assembly timeout
```

## 🐛 Troubleshooting

### No frames received:
1. Check camera is streaming: `netstat -an | grep 6611`
2. Verify subscription: Check browser console
3. Check server logs for frame assembly

### High latency:
1. Reduce keyframe interval on camera
2. Use sub-stream instead of main stream
3. Check network bandwidth

### Disconnections:
1. Check TCP keepalive settings
2. Verify firewall allows WebSocket
3. Monitor server logs for errors

## 📚 Protocol Reference

### JT/T 1078 Commands:
- **0x9101**: Start real-time video (Table 17)
- **0x9102**: Control transmission (pause/resume)
- **0x9105**: Status notification (keepalive)

### RTP Packet Structure (Table 19):
```
[Frame Header] [RTP] [SIM] [Channel] [DataType+Subpackage]
[Timestamp] [I-Frame Interval] [Frame Interval] [Length] [Payload]
```

### Connection Lifecycle:
```
1. Camera → TCP Auth (0x0102)
2. Server → Query Caps (0x9003)
3. Server → Start Video (0x9101)
4. Camera → RTP Stream (continuous)
5. Server → Status Check (0x9105) every 30s
6. Server → Stop Video (0x9102) when done
```

## ✅ Production Checklist

- [ ] Test with real cameras
- [ ] Monitor memory usage under load
- [ ] Implement rate limiting
- [ ] Add authentication to WebSocket
- [ ] Set up HTTPS/WSS for production
- [ ] Configure CDN for scaling
- [ ] Add recording on-demand
- [ ] Implement stream quality switching
- [ ] Add error recovery mechanisms
- [ ] Monitor frame drop rates

## 🎬 Next Steps

1. **Test with real camera** - Verify end-to-end flow
2. **Add H.264 decoder** - Use JSMpeg or Broadway.js
3. **Implement HLS fallback** - For iOS/Safari support
4. **Add DVR features** - Pause, rewind, fast-forward
5. **Multi-camera grid** - Display 4/9/16 cameras simultaneously
