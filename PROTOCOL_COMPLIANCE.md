# Protocol-Based Data Handling

## Video Data (Table 19 - RTP Format)

### RTP Packet Structure:
```
Byte 0-3:   Frame header (0x30316364)
Byte 4:     RTP version/flags
Byte 5:     Marker + Payload type
Byte 6-7:   Sequence number
Byte 8-13:  SIM card number (BCD)
Byte 14:    Channel number
Byte 15:    Data type (4 bits) + Subpackage flag (4 bits)
            Data type:
              0000 = Video I-frame
              0001 = Video P-frame
              0010 = Video B-frame
              0011 = Audio frame
            Subpackage:
              0000 = Atomic (complete)
              0001 = First packet
              0010 = Last packet
              0011 = Middle packet
Byte 16-23: Timestamp (8 bytes)
Byte 24-25: Last I-frame interval
Byte 26-27: Last frame interval
Byte 28-29: Data body length
Byte 30+:   H.264 video data
```

### Current Implementation Status:
✅ RTP parser (`src/udp/rtpParser.ts`) - CORRECT
✅ Frame assembler (`src/udp/frameAssembler.ts`) - CORRECT
✅ Video writer (`src/video/writer.ts`) - CORRECT

**Video handling is ALREADY protocol-compliant!**

---

## Image Data (JT/T 808 - 0x0801 Multimedia Upload)

### Multimedia Message Structure (0x0801):
```
Byte 0-3:   Multimedia ID (DWORD)
Byte 4:     Multimedia type (0=image, 1=audio, 2=video)
Byte 5:     Format (0=JPEG, 1=TIF, 2=MP3, 3=WAV, 4=WMV)
Byte 6:     Event code
Byte 7:     Channel ID
Byte 8+:    Image data (JPEG format)
```

### JPEG Format Requirements:
- **Start marker**: 0xFFD8 (SOI - Start of Image)
- **End marker**: 0xFFD9 (EOI - End of Image)
- **Complete structure**: SOI + data + EOI

### Fragmentation Handling:
Images may come in multiple 0x0801 messages:
1. First fragment: Contains JPEG start (0xFFD8)
2. Middle fragments: Continue data
3. Last fragment: Contains JPEG end (0xFFD9)

**Current implementation handles this correctly!**

---

## What We Fixed:

1. ✅ **JPEG Validation**: Check for 0xFFD8 start and 0xFFD9 end
2. ✅ **Fragment Assembly**: Buffer incomplete JPEGs until complete
3. ✅ **Protocol Parsing**: Extract channel, event code from byte 6-7
4. ✅ **Database Storage**: Save metadata after validation

---

## Testing Checklist:

### For Videos:
```bash
# Check RTP packets are received
# Look for: "Frame header: 0x30316364"

# Check frame assembly
# Look for: "Complete frame assembled"

# Check file creation
# Look for: "Video recording started: recordings/xxx/channel_1_xxx.h264"

# Verify database entry
SELECT * FROM videos WHERE device_id = 'xxx' ORDER BY start_time DESC LIMIT 1;
```

### For Images:
```bash
# Request screenshot
curl -X POST http://localhost:3000/api/vehicles/xxx/screenshot

# Check multimedia message
# Look for: "✅ Complete JPEG: X bytes, channel Y, event Z"

# Check file creation
# Look for: "💾 Saved valid JPEG: media/xxx/screenshot.jpg"

# Verify database entry
SELECT * FROM images WHERE device_id = 'xxx' ORDER BY timestamp DESC LIMIT 1;

# Test image validity
# Open the JPEG file - should display correctly
```

---

## Common Issues & Solutions:

### Broken Images:
- **Cause**: Incomplete JPEG (missing 0xFFD9)
- **Solution**: Fragment buffering (already implemented)
- **Check**: Look for "Invalid JPEG: Missing end marker" in logs

### Missing Videos:
- **Cause**: RTP packets on wrong port
- **Solution**: Ensure UDP:6611 is open and camera configured correctly
- **Check**: `netstat -an | findstr 6611`

### Database Not Saving:
- **Cause**: Database connection failed
- **Solution**: Check .env file and PostgreSQL connection
- **Check**: Look for "✅ Database connected" on startup
