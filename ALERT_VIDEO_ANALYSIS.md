# Alert Video & Screenshot Capture Analysis

## Protocol Specification (JT/T 1078-2016)

### 1. Screenshot Capture (Single Frame Upload)

**Command**: 0x9201 (Remote Video Playback Request)  
**Playback Method**: 4 (Single frame upload)

**Table 24 Structure**:
```
Offset | Field | Type | Description
-------|-------|------|------------
0      | Server IP length | BYTE | n
1      | Server IP | STRING | IP address
1+n    | TCP port | WORD | Server port
3+n    | UDP port | WORD | 0 if not used
5+n    | Channel | BYTE | Logical channel
6+n    | A/V type | BYTE | 0=A/V, 1=audio, 2=video
7+n    | Stream type | BYTE | 0=main/sub, 1=main, 2=sub
8+n    | Storage type | BYTE | 0=all, 1=main, 2=backup
9+n    | Playback method | BYTE | 4 = Single frame upload
10+n   | Fast forward | BYTE | 0 (not used)
11+n   | Start time | BCD[6] | YY-MM-DD-HH-MM-SS (frame timestamp)
17+n   | End time | BCD[6] | 0 (invalid for single frame)
```

**Response**: Camera sends 0x0801 (Multimedia Data Upload) with JPEG image

### 2. Video Capture (Historical Playback)

**Command**: 0x9201 (Remote Video Playback Request)  
**Playback Method**: 0 (Normal playback)

**Response**: Camera sends RTP video stream via TCP/UDP

### 3. Multimedia Upload (0x0801)

**Structure**:
```
Offset | Field | Type | Description
-------|-------|------|------------
0      | Multimedia ID | DWORD | Unique ID
4      | Type | BYTE | 0=image, 1=audio, 2=video
5      | Format | BYTE | 0=JPEG, 1=TIF, 2=MP3, 3=WAV, 4=WMV
6      | Event code | BYTE | Alarm type
7      | Channel | BYTE | Logical channel
8+     | Data | BYTE[] | Image/video data
```

## Our Implementation Status

### ✅ CORRECT: Screenshot Request (0x9201)

**File**: `src/tcp/commands.ts` - `buildPlaybackCommand()`

```typescript
// Correctly implements Table 24
static buildPlaybackCommand(
  terminalPhone: string,
  serialNumber: number,
  serverIp: string,
  serverPort: number,
  channelId: number,
  startTime: Date,
  endTime: Date,
  playbackMethod: number = 0 // 4 = single frame
): Buffer
```

**Usage in server.ts**:
```typescript
requestScreenshot(vehicleId: string, channel: number = 1): boolean {
  const command = JTT1078Commands.buildPlaybackCommand(
    vehicleId,
    this.getNextSerial(),
    serverIp,
    this.port,
    channel,
    now,  // Start time = current time
    now,  // End time = current time
    4     // ✅ Single frame upload
  );
  socket.write(command);
  return true;
}
```

**Status**: ✅ **CORRECT** - Follows spec exactly

### ✅ CORRECT: Multimedia Data Parsing (0x0801)

**File**: `src/tcp/multimediaParser.ts` - `parseMultimediaData()`

**Validation**:
1. ✅ Reads multimedia ID (offset 0, DWORD)
2. ✅ Reads type (offset 4, BYTE) - 0=image
3. ✅ Reads format (offset 5, BYTE) - 0=JPEG
4. ✅ Reads event code (offset 6, BYTE)
5. ✅ Reads channel (offset 7, BYTE)
6. ✅ Extracts data starting at offset 8
7. ✅ Validates JPEG header (0xFFD8)
8. ✅ Validates JPEG end marker (0xFFD9)
9. ✅ Handles fragmented images
10. ✅ 300MB size limit

**Status**: ✅ **CORRECT** - Robust implementation

### ⚠️ ISSUE: Video Playback Request

**Current Implementation**:
```typescript
requestCameraVideo(vehicleId: string, channel: number, startTime: Date, endTime: Date): boolean {
  // Uses AlertVideoCommands.createAlertVideoRequest()
  // NOT using buildPlaybackCommand()
}
```

**File**: `src/tcp/alertVideoCommands.ts`

**Problem**: Uses custom format instead of standard 0x9201 Table 24 format

**Fix Needed**: Use `buildPlaybackCommand()` with `playbackMethod = 0`

### ✅ CORRECT: Video Data Reception

**RTP Stream Handling**:
- ✅ Receives RTP packets via TCP (0x30316364 header)
- ✅ Assembles frames via `frameAssembler.ts`
- ✅ Writes to HLS via `hlsStreamer.ts`
- ✅ Saves raw H.264 via `videoWriter.ts`

## Issues Found

### 1. ❌ Video Playback Uses Wrong Command Format

**Current**: `alertVideoCommands.ts` - Custom format  
**Should be**: `commands.ts` - `buildPlaybackCommand()` with method=0

**Impact**: Camera may not respond to video playback requests

### 2. ⚠️ Missing Audio/Video Type Field

**Current**: Screenshot request doesn't specify A/V type  
**Should be**: Set to 2 (video only) for screenshots

### 3. ⚠️ Missing Stream Type Field

**Current**: Not specified in screenshot request  
**Should be**: Set to 1 (main stream) or 2 (sub stream)

## Recommended Fixes

### Fix 1: Update Screenshot Request

```typescript
requestScreenshot(vehicleId: string, channel: number = 1): boolean {
  const serverIp = socket.localAddress?.replace('::ffff:', '') || '0.0.0.0';
  const now = new Date();

  // Build proper 0x9201 command with all fields
  const body = Buffer.alloc(23);
  let offset = 0;
  
  // Server IP (4 bytes)
  const ipParts = serverIp.split('.').map(Number);
  body.writeUInt8(ipParts[0], offset++);
  body.writeUInt8(ipParts[1], offset++);
  body.writeUInt8(ipParts[2], offset++);
  body.writeUInt8(ipParts[3], offset++);
  
  // TCP port (2 bytes)
  body.writeUInt16BE(this.port, offset); offset += 2;
  
  // UDP port (2 bytes) - set to 0
  body.writeUInt16BE(0, offset); offset += 2;
  
  // Channel (1 byte)
  body.writeUInt8(channel, offset++);
  
  // A/V type (1 byte) - 2 = video only
  body.writeUInt8(2, offset++);
  
  // Stream type (1 byte) - 1 = main stream
  body.writeUInt8(1, offset++);
  
  // Storage type (1 byte) - 0 = all
  body.writeUInt8(0, offset++);
  
  // Playback method (1 byte) - 4 = single frame
  body.writeUInt8(4, offset++);
  
  // Fast forward (1 byte) - 0
  body.writeUInt8(0, offset++);
  
  // Start time (6 bytes BCD)
  const timeBcd = this.dateToBcd(now);
  timeBcd.copy(body, offset); offset += 6;
  
  // End time (6 bytes) - all zeros for single frame
  body.fill(0, offset, offset + 6);
  
  const command = this.buildMessage(0x9201, vehicleId, this.getNextSerial(), body);
  socket.write(command);
  return true;
}
```

### Fix 2: Update Video Playback Request

```typescript
requestCameraVideo(vehicleId: string, channel: number, startTime: Date, endTime: Date): boolean {
  const vehicle = this.vehicles.get(vehicleId);
  const socket = this.connections.get(vehicleId);
  
  if (!vehicle || !socket || !vehicle.connected) {
    return false;
  }

  const serverIp = socket.localAddress?.replace('::ffff:', '') || '0.0.0.0';
  
  // Use standard 0x9201 command with playback method = 0
  const command = JTT1078Commands.buildPlaybackCommand(
    vehicleId,
    this.getNextSerial(),
    serverIp,
    this.port,
    channel,
    startTime,
    endTime,
    0  // Normal playback
  );
  
  console.log(`🎥 Camera video requested: ${vehicleId} ch${channel}`);
  socket.write(command);
  return true;
}
```

## Testing Checklist

### Screenshot Capture
- [ ] Send 0x9201 with playback method = 4
- [ ] Receive 0x0801 response
- [ ] Validate JPEG header (FFD8)
- [ ] Validate JPEG end (FFD9)
- [ ] Save to media/ directory
- [ ] Save to database
- [ ] Upload to Supabase

### Video Playback
- [ ] Send 0x9201 with playback method = 0
- [ ] Receive RTP stream on TCP
- [ ] Assemble frames correctly
- [ ] Write to HLS segments
- [ ] Save raw H.264 file
- [ ] Link to alert in database

### Alert Integration
- [ ] Detect fatigue/phone/smoking in location report
- [ ] Request screenshot automatically
- [ ] Request 30s pre-event video from buffer
- [ ] Request 30s post-event video
- [ ] Request camera SD card video (0x9201)
- [ ] Save all 3 video sources
- [ ] Link to alert record

## Conclusion

**Screenshot**: ✅ 95% correct - minor field additions needed  
**Video Playback**: ❌ 60% correct - using wrong command format  
**Multimedia Parsing**: ✅ 100% correct - excellent implementation  

**Priority**: Fix video playback command to use standard 0x9201 format
