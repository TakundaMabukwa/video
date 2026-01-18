# JT/T 1078 Implementation Checklist - Complete Coverage

## ✅ FIXED: Critical RTP Packet Structure (Table 19)

### Correct Packet Structure:
```
Byte 0-3:   Frame Header (0x30316364) ✅
Byte 4:     V(2) P(1) X(1) CC(4) ✅
Byte 5:     M(1) PT(7) ✅
Byte 6-7:   Sequence Number (WORD) ✅
Byte 8-13:  SIM Card Number (BCD[6]) ✅ FIXED
Byte 14:    Logical Channel Number ✅ FIXED
Byte 15:    Data Type (4 bits) + Subpackage Flag (4 bits) ✅ FIXED
Byte 16-23: Timestamp (8 bytes, ms) - NOT for transparent data ✅ FIXED
Byte 24-25: Last I-Frame Interval (WORD) - Video only ✅ FIXED
Byte 26-27: Last Frame Interval (WORD) - Video only ✅ FIXED
Byte 28-29: Data Body Length (WORD) ✅ FIXED
Byte 30+:   Payload (max 950 bytes) ✅
```

### Data Type Values (4 bits):
- `0x0` = Video I-frame ✅
- `0x1` = Video P-frame ✅
- `0x2` = Video B-frame ✅
- `0x3` = Audio frame ✅
- `0x4` = Transparent data ✅

### Subpackage Flag (4 bits):
- `0x0` = Atomic (complete frame) ✅
- `0x1` = First subpackage ✅
- `0x2` = Last subpackage ✅
- `0x3` = Middle subpackage ✅

## ✅ FIXED: H.264 Video Decoding Requirements

1. **SPS/PPS Extraction** ✅
   - NAL type 7 (SPS) detection and caching
   - NAL type 8 (PPS) detection and caching
   - Per-stream parameter set storage

2. **SPS/PPS Prepending** ✅
   - Automatically prepend to I-frames (NAL type 5)
   - Required for decoder initialization

3. **Frame Writing** ✅
   - Write ALL frames (I, P, B) not just I-frames
   - Maintain proper frame sequence

## 📋 Edge Cases & Protocol Requirements

### 1. Payload Size Validation
- ✅ Max 950 bytes per packet (Table 19)
- ✅ Validate against buffer length

### 2. Subpackage Handling
- ✅ Atomic packets (complete frame)
- ✅ Multi-packet frame assembly
- ✅ Sequence number validation
- ✅ Timeout cleanup (5 seconds)
- ✅ Buffer limits (500 max)

### 3. Channel Types (Table 3)
- Audio and video (0)
- Audio only (1)
- Video only (2)

### 4. Stream Types (Table 17)
- Main stream (0)
- Sub stream (1)

### 5. Encoding Support (Table 12)
**Audio:**
- G.711A/U, G.726, AAC, MP3, etc.

**Video:**
- H.264 (98) ✅ Primary
- H.265 (99)
- AVS (100)
- SVAC (101)

### 6. Real-time Transmission Control (0x9102)
Commands to handle:
- Close transmission (0)
- Switch stream (1)
- Pause all streams (2)
- Resume streams (3)
- Close two-way intercom (4)

### 7. Transmission Status Notification (0x9105)
Platform sends periodic status with:
- Logical channel number
- Packet loss rate

### 8. Video Alarm Types (Table 14)
- Video signal loss (bit 0)
- Video signal blocking (bit 1)
- Storage failure (bit 2)
- Other equipment failure (bit 3)
- Bus overcrowding (bit 4)
- Abnormal driving (bit 5)
- Storage threshold reached (bit 6)

## 🔧 Additional Protocol Features

### Audio/Video Parameters (0x8103)
Settings include:
- Encoding mode (CBR/VBR/ABR)
- Resolution (QCIF/CIF/D1/720P/1080P)
- Keyframe interval (1-1000 frames)
- Target frame rate (1-120 fps)
- Target bitrate (kbps)
- OSD overlay settings

### PTZ Control Commands
- Rotation (0x9301)
- Focus adjustment (0x9302)
- Aperture control (0x9303)
- Wiper control (0x9304)
- Infrared fill light (0x9305)
- Zoom control (0x9306)

### Historical Video Operations
- Query resource list (0x9205)
- Remote playback (0x9201)
- Playback control (0x9202)
- File upload via FTP (0x9206)
- Upload completion notification (0x1206)

## 🎯 Live Streaming Requirements Met

### For Proper Live Video:
1. ✅ Correct packet parsing with all fields
2. ✅ Data type identification (I/P/B frames)
3. ✅ SPS/PPS parameter set handling
4. ✅ Complete frame assembly
5. ✅ All frames written (not just I-frames)
6. ✅ Proper H.264 NAL unit structure
7. ✅ 950-byte payload limit enforcement

### For HLS/FFmpeg Compatibility:
1. ✅ SPS prepended before I-frames
2. ✅ PPS prepended before I-frames
3. ✅ Continuous frame stream (I+P+B)
4. ✅ Proper start codes (0x00 0x00 0x00 0x01)

## 🚨 Critical Notes

1. **Timestamp Field**: 8 bytes (bigint), NOT 4 bytes
2. **SIM Card**: BCD encoded, 6 bytes
3. **Data Type + Subpackage**: Combined in single byte (4+4 bits)
4. **Video Intervals**: Only present for video frames (types 0-2)
5. **Transparent Data**: No timestamp field when type = 0x04
6. **Max Payload**: 950 bytes per spec

## 📊 Testing Checklist

- [ ] Verify SIM card parsing from real device
- [ ] Test I-frame detection and SPS/PPS extraction
- [ ] Validate multi-packet frame assembly
- [ ] Check timestamp handling (8-byte bigint)
- [ ] Test with different resolutions (720P, 1080P)
- [ ] Verify HLS stream playback
- [ ] Test packet loss handling
- [ ] Validate 950-byte payload limit

## 🔍 Monitoring & Debugging

Log these for troubleshooting:
- Data type per packet (I/P/B/Audio)
- SPS/PPS detection events
- Frame assembly success/failure
- Timestamp values
- Last I-frame interval
- Payload sizes
- Sequence number gaps
