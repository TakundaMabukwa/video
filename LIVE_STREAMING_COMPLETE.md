# JT/T 1078 Live Streaming - Implementation Complete

## ✅ All Critical Fixes Applied

### 1. **Correct RTP Packet Parsing (Table 19)**
- ✅ SIM card field (BCD[6]) at bytes 8-13
- ✅ Data type (4 bits) + subpackage flag (4 bits) at byte 15
- ✅ 8-byte timestamp (bigint) at bytes 16-23
- ✅ Last I-frame interval (WORD) at bytes 24-25 (video only)
- ✅ Last frame interval (WORD) at bytes 26-27 (video only)
- ✅ Payload length at correct offset
- ✅ 950-byte max payload validation

### 2. **H.264 Video Decoding**
- ✅ SPS (NAL type 7) extraction and caching
- ✅ PPS (NAL type 8) extraction and caching
- ✅ Automatic SPS/PPS prepending to I-frames
- ✅ All frames (I+P+B) written for smooth playback

### 3. **0x9101 Command Fix (Table 17)**
- ✅ Server IP as STRING (not 4-byte binary)
- ✅ Separate TCP and UDP ports
- ✅ Correct field order and sizes

### 4. **Auto-Discovery & Streaming**
- ✅ Query capabilities (0x9003) on camera authentication
- ✅ Parse max video channels from response (Table 11)
- ✅ Auto-start video streams on all discovered channels
- ✅ Staggered stream initiation (500ms delay per channel)

## 🎬 How It Works Now

### Connection Flow:
```
1. Camera connects → TCP authentication (0x0102)
2. Server queries capabilities (0x9003)
3. Camera responds with channel count
4. Server auto-starts video on all channels (0x9101)
5. Camera sends RTP video to UDP port 6611
6. Server parses, assembles, and writes H.264 frames
```

### Command Sequence:
```
Platform → Camera: 0x9003 (Query capabilities)
Camera → Platform: 0x1003 (Max channels: N)
Platform → Camera: 0x9101 (Start video, channel 1)
Platform → Camera: 0x9101 (Start video, channel 2)
...
Camera → Platform: RTP packets on UDP 6611
```

## 📊 What Gets Logged

```
✅ Camera authenticated: 013912345678
🔍 Querying capabilities for 013912345678...
📊 Camera Capabilities:
   Video: encoding=98, max channels=4
   Max video channels: 4
✅ Discovered 4 video channels

🎬 Auto-starting video streams on all channels...
▶️ Starting stream on channel 1
📡 Sending 0x9101: TCP=7611, UDP=6611, Channel=1
▶️ Starting stream on channel 2
📡 Sending 0x9101: TCP=7611, UDP=6611, Channel=2
...
```

## 🔧 Key Files Modified

1. **src/types/jtt.ts** - Updated RTP header interface
2. **src/udp/rtpParser.ts** - Complete rewrite per spec
3. **src/udp/frameAssembler.ts** - Added SPS/PPS handling
4. **src/tcp/commands.ts** - Fixed 0x9101 structure
5. **src/tcp/server.ts** - Added auto-discovery logic
6. **src/udp/server.ts** - Write all frames, not just I-frames

## 🎯 Testing Checklist

- [ ] Connect real JT/T 1078 camera
- [ ] Verify capabilities query response
- [ ] Confirm auto-stream initiation
- [ ] Check UDP packets arriving on port 6611
- [ ] Verify SPS/PPS extraction in logs
- [ ] Confirm H.264 files in `recordings/` folder
- [ ] Test HLS playback
- [ ] Verify all channels streaming

## 📝 Manual Stream Control

If auto-start doesn't work, use API:

```bash
# Start specific channel
curl -X POST http://localhost:3000/api/vehicles/{vehicleId}/start-live \
  -H "Content-Type: application/json" \
  -d '{"channel": 1}'

# Check stream status
curl http://localhost:3000/api/vehicles/{vehicleId}/stream-info?channel=1
```

## 🐛 Troubleshooting

### No RTP packets received:
1. Check camera sends to correct UDP port (6611)
2. Verify firewall allows UDP 6611
3. Check camera received 0x9101 command
4. Look for "Video stream request acknowledged" log

### Video files empty:
1. Check SPS/PPS extraction logs
2. Verify frame assembly (check sequence numbers)
3. Ensure all frame types being written (not just I-frames)

### Can't play H.264 files:
1. Files need SPS/PPS prepended to I-frames
2. Check for "SPS" and "PPS" in hex dump
3. Try: `ffplay recordings/{vehicleId}/channel_1_*.h264`

## 🚀 Next Steps

1. Test with real cameras
2. Monitor frame rates and packet loss
3. Tune buffer sizes if needed
4. Add stream quality metrics
5. Implement adaptive bitrate switching

## 📚 Reference

- JT/T 1078-2016 Table 17: Real-time video transmission request
- JT/T 1078-2016 Table 19: RTP packet format
- JT/T 1078-2016 Table 11: Terminal capabilities response
- H.264 NAL types: 5=IDR, 7=SPS, 8=PPS
