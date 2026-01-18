# Live Video Streaming Implementation Guide

## Complete Flow for Connecting to Live Cameras

### 1. Camera Connection & Authentication

When a camera connects to the TCP server (default port 6100):

1. **Terminal Registration (0x0100)** - Camera sends registration
   - Server responds with `0x8100` including auth token
   
2. **Terminal Authentication (0x0102)** - Camera authenticates
   - Server responds with `0x8001` (general response - success)
   - Server automatically queries capabilities after 1 second delay

### 2. Automatic Channel Discovery

After authentication, the server **automatically**:

1. **Query Capabilities (0x9003)** - Server sends to camera
   ```typescript
   queryCapabilities(vehiclePhone);
   ```

2. **Capabilities Response (0x1003)** - Camera responds with:
   - Audio encoding settings
   - Video encoding type (typically H.264 = 98, H.265 = 99)
   - **Max audio channels**
   - **Max video channels** ← Used to discover available channels

3. **Parse & Store Channels**
   - Creates channel list based on `maxVideoChannels`
   - Each channel gets physical/logical number (1, 2, 3, etc.)
   - Stores in vehicle object

### 3. Automatic Video Stream Initiation

After discovering channels, server **automatically starts video streams**:

```typescript
// Auto-start all discovered channels (staggered by 500ms)
for (const channel of channels) {
  setTimeout(() => {
    startVideo(vehiclePhone, channel.logicalChannel);
  }, 500 * channel.logicalChannel);
}
```

### 4. Start Video Request (0x9101)

For each channel, server sends:

```typescript
buildStartVideoCommand(
  vehiclePhone,
  serialNumber,
  serverIp,        // Server's IP where camera should send data
  tcpPort,         // TCP port (6100) - for signaling
  udpPort,         // UDP port (6200) - for RTP video stream
  channelNumber,   // 1, 2, 3, etc.
  dataType,        // 1 = Video only, 0 = Audio+Video
  streamType       // 0 = Main stream, 1 = Sub stream
)
```

**Critical**: Uses **STRING** format for IP address as per Table 17 spec:
- IP length (1 byte)
- IP address (ASCII string)
- TCP port (2 bytes)
- UDP port (2 bytes)
- Logical channel number (1 byte)
- Data type (1 byte)
- Stream type (1 byte)

### 5. Camera Acknowledges & Streams

1. **General Response (0x0001)** - Camera acknowledges video request
   - Result = 0 (success)
   - Server logs: `✅ Video stream request acknowledged`

2. **RTP Video Stream** - Camera starts sending to UDP port
   - Uses JT/T 1078 RTP format (0x30316364 header)
   - Contains SIM card, channel number, timestamp
   - H.264/H.265 video payload

### 6. Video Reception & Processing

**UDP Server (port 6200)** receives RTP packets:

```typescript
// Frame assembly
frameAssembler.assembleFrame(header, payload, dataType)

// When complete frame ready:
- Add to circular buffer (for alerts - 30s rolling window)
- Write to HLS stream (for live viewing)
- Write to disk (for recording)
```

### 7. Live Viewing

**HLS Streaming** available at:
```
http://localhost:3000/api/hls/{vehicleId}/{channel}/stream.m3u8
```

**WebSocket** for real-time updates:
```javascript
ws://localhost:3000
// Sends frame data, stream status, alerts
```

## Key Implementation Details

### Automatic vs Manual Stream Start

**Automatic (Implemented)**:
- ✅ Query capabilities when camera authenticates
- ✅ Parse max video channels from 0x1003 response
- ✅ Auto-start video on all discovered channels
- ✅ Stagger requests by 500ms to avoid overwhelming camera

**Manual Alternative**:
```typescript
// API endpoint to manually start stream
POST /api/vehicles/:vehicleId/channels/:channel/start
```

### Data Types (Table 17)

| Value | Description |
|-------|-------------|
| 0 | Audio + Video |
| 1 | Video only |
| 2 | Two-way intercom |
| 3 | Monitoring (listen only) |
| 4 | Central broadcasting |
| 5 | Transparent transmission |

### Stream Types

| Value | Description |
|-------|-------------|
| 0 | Main stream (high quality) |
| 1 | Sub stream (lower quality) |

## Troubleshooting

### Camera Not Streaming

1. **Check capabilities response**:
   - Is `maxVideoChannels` > 0?
   - Did server receive 0x1003 response?

2. **Check 0x9101 command**:
   - Is server IP correct (not loopback)?
   - Are ports accessible from camera network?
   - Is command structure matching Table 17 (STRING format)?

3. **Check camera network**:
   - Can camera reach server's UDP port?
   - Firewall blocking UDP 6200?
   - NAT issues?

4. **Check camera logs**:
   - Did camera acknowledge with 0x0001?
   - Result = 0 (success)?

### No Video Data on UDP

1. **Verify UDP server is listening**:
   ```
   netstat -an | grep 6200
   ```

2. **Check camera can reach UDP port**:
   - May need to bind to 0.0.0.0 instead of localhost
   - Check server's actual IP camera sees

3. **Network topology**:
   - Direct connection vs through NAT
   - UDP packets may be dropped by firewall

## Current Status

✅ **Implemented**:
- TCP server on port 6100
- UDP server on port 6200
- Automatic capability query on auth
- Automatic channel discovery
- Automatic video stream start on all channels
- RTP packet parsing & frame assembly
- HLS stream generation
- Alert circular buffer (30s rolling)
- Video recording to disk

🎯 **What Happens Now**:
1. Camera connects → Server queries capabilities
2. Server discovers channels (1, 2, 3, etc.)
3. Server automatically starts video stream on each channel
4. Camera sends RTP video to UDP port 6200
5. Video available via HLS & WebSocket
6. Continuous recording & alert monitoring

## Testing

To verify it's working:

1. **Check logs** when camera connects:
   ```
   ✅ Camera authenticated: [phone]
   🔍 Querying capabilities for [phone]...
   📊 Camera Capabilities: max channels=X
   ✅ Discovered N video channels
   🎬 Auto-starting video streams...
   ▶️ Starting stream on channel 1
   ✅ Video stream request acknowledged
   ```

2. **Check UDP packets**:
   ```
   New stream started: [IP]_1, dataType: I-frame
   Processed X packets in last 5s
   ```

3. **Access HLS stream**:
   ```
   http://localhost:3000/api/hls/[vehicleId]/1/stream.m3u8
   ```

## Code References

- **Commands**: [src/tcp/commands.ts](src/tcp/commands.ts) - Line 12-58
- **Auto-start flow**: [src/tcp/server.ts](src/tcp/server.ts) - Line 454-496
- **UDP reception**: [src/udp/server.ts](src/udp/server.ts)
- **HLS streaming**: [src/streaming/hls.ts](src/streaming/hls.ts)
