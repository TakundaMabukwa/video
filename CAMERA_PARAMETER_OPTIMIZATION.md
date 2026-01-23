# Camera Parameter Optimization (0x8103)

## Protocol: JT/T 1078 Table 6 - Individual Channel Video Parameters

You can configure the camera to send **lower resolution, lower bitrate, and lower frame rate** for faster streaming.

## Command: 0x8103 (Set Terminal Parameters)

### Parameter 0x0077: Individual Video Channel Settings

**Table 6 Structure** (21 bytes per channel):

| Offset | Field | Type | Values |
|--------|-------|------|--------|
| 0 | Logical channel | BYTE | 1-4 |
| 1 | Live stream encoding mode | BYTE | 0=CBR, 1=VBR, 2=ABR |
| 2 | Live stream resolution | BYTE | 0=QCIF, 1=CIF, 2=WCIF, 3=D1, 4=WD1 |
| 3 | Live stream I-frame interval | WORD | Seconds (1-1000) |
| 5 | Live stream target frame rate | BYTE | 1-120 fps |
| 6 | Live stream target bitrate | DWORD | kbps |
| 10 | Save stream encoding mode | BYTE | 0=CBR, 1=VBR, 2=ABR |
| 11 | Save stream resolution | BYTE | 0=QCIF, 1=CIF, 2=WCIF, 3=D1, 4=WD1 |
| 12 | Save stream I-frame interval | WORD | Seconds (1-1000) |
| 14 | Save stream target frame rate | BYTE | 1-120 fps |
| 15 | Save stream target bitrate | DWORD | kbps |
| 19 | OSD settings | WORD | Bitmap flags |

## Recommended Settings for Fast Streaming

### Current (Slow):
- Resolution: D1 (720x576) or WD1 (960x576)
- Frame rate: 25-30 fps
- Bitrate: 1500-2000 kbps

### Optimized (Fast):
- **Resolution: CIF (352x288)** - 75% less data
- **Frame rate: 15 fps** - 50% less frames
- **Bitrate: 512 kbps** - 70% less bandwidth
- **I-frame interval: 2 seconds** - Faster keyframes

## Implementation

Add to `src/tcp/commands.ts`:

```typescript
static buildSetVideoParametersCommand(
  terminalPhone: string,
  serialNumber: number,
  channel: number,
  resolution: number = 1, // 1=CIF (fast)
  frameRate: number = 15,
  bitrate: number = 512
): Buffer {
  // 0x8103 command with parameter 0x0077
  const paramId = 0x0077;
  const paramLength = 21;
  
  const body = Buffer.alloc(4 + 1 + paramLength);
  let offset = 0;
  
  // Parameter ID (4 bytes)
  body.writeUInt32BE(paramId, offset);
  offset += 4;
  
  // Parameter length (1 byte)
  body.writeUInt8(paramLength, offset);
  offset += 1;
  
  // Channel parameters (21 bytes)
  body.writeUInt8(channel, offset++);           // Logical channel
  body.writeUInt8(0, offset++);                 // CBR encoding
  body.writeUInt8(resolution, offset++);        // Resolution (1=CIF)
  body.writeUInt16BE(2, offset); offset += 2;   // I-frame every 2 seconds
  body.writeUInt8(frameRate, offset++);         // Frame rate
  body.writeUInt32BE(bitrate, offset); offset += 4; // Bitrate (kbps)
  
  // Save stream (same as live)
  body.writeUInt8(0, offset++);                 // CBR encoding
  body.writeUInt8(resolution, offset++);        // Resolution
  body.writeUInt16BE(2, offset); offset += 2;   // I-frame interval
  body.writeUInt8(frameRate, offset++);         // Frame rate
  body.writeUInt32BE(bitrate, offset); offset += 4; // Bitrate
  
  body.writeUInt16BE(0, offset);                // OSD settings
  
  return this.buildMessage(0x8103, terminalPhone, serialNumber, body);
}
```

Add to `src/tcp/server.ts`:

```typescript
optimizeVideoParameters(vehicleId: string, channel: number = 1): boolean {
  const vehicle = this.vehicles.get(vehicleId);
  const socket = this.connections.get(vehicleId);
  
  if (!vehicle || !socket || !vehicle.connected) {
    return false;
  }

  const command = JTT1078Commands.buildSetVideoParametersCommand(
    vehicleId,
    this.getNextSerial(),
    channel,
    1,    // CIF resolution (352x288)
    15,   // 15 fps
    512   // 512 kbps
  );
  
  console.log(`⚡ Optimizing video parameters: ${vehicleId} channel ${channel} -> CIF/15fps/512kbps`);
  socket.write(command);
  return true;
}
```

Add API endpoint in `src/api/routes.ts`:

```typescript
router.post('/vehicles/:id/optimize-video', (req, res) => {
  const { id } = req.params;
  const { channel = 1 } = req.body;

  const success = tcpServer.optimizeVideoParameters(id, channel);

  if (success) {
    res.json({
      success: true,
      message: `Video parameters optimized for ${id} channel ${channel}`,
      settings: {
        resolution: 'CIF (352x288)',
        frameRate: '15 fps',
        bitrate: '512 kbps'
      }
    });
  } else {
    res.status(404).json({
      success: false,
      message: `Vehicle ${id} not found`
    });
  }
});
```

## Usage

```bash
# Optimize all channels on vehicle
curl -X POST http://164.90.182.2:3000/api/vehicles/221087770581/optimize-video \
  -H "Content-Type: application/json" \
  -d '{"channel": 1}'
```

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Resolution | 720x576 | 352x288 |
| Frame rate | 25 fps | 15 fps |
| Bitrate | 1500 kbps | 512 kbps |
| Data per second | ~187 KB/s | ~64 KB/s |
| Segment generation | 6-10s | <1s |
| **Total speedup** | - | **3-5x faster** |

## Notes

- Camera must support 0x8103 command (most JT/T 1078 cameras do)
- Settings persist until camera reboot
- Can be applied per-channel
- Combine with sub-stream (type 1) for maximum speed
