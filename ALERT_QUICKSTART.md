# Alert System - Quick Start

## ✅ Implementation Complete

The alert management system with 30-second pre/post event recording, escalation, and real-time notifications has been fully implemented following JT/T 1078 protocol specifications.

## 🚀 Installation

```bash
cd c:\Users\mabuk\Desktop\servers\video
npm install
npm run dev
```

## 📊 Access Dashboards

- **Alert Dashboard**: http://localhost:3000/alert-dashboard.html
- **Video Viewer**: http://localhost:3000/viewer.html
- **Main Dashboard**: http://localhost:3000/

## 🔔 Features Implemented

### 1. 30-Second Pre/Post Event Recording
- ✅ Circular buffer maintains 30 seconds of video in memory
- ✅ On alert: Saves pre-event buffer + records 30s post-event
- ✅ Saved to: `recordings/{vehicleId}/alerts/`

### 2. Priority-Based Alerts
- ✅ **CRITICAL**: Fatigue > 80
- ✅ **HIGH**: Fatigue, Phone call, Smoking, Storage failure
- ✅ **MEDIUM**: Signal loss, Blocking, Overcrowding
- ✅ **LOW**: Other alerts

### 3. Escalation System
- ✅ **5 minutes**: Escalate to supervisor
- ✅ **10 minutes**: Escalate to management
- ✅ **Flooding detection**: >10 alerts/minute

### 4. Real-Time Notifications
- ✅ WebSocket connection: `ws://localhost:3000/ws/alerts`
- ✅ Bell sound notifications
- ✅ Visual alerts with priority colors
- ✅ Live dashboard updates

## 📡 API Endpoints

```bash
# Get active alerts
curl http://localhost:3000/api/alerts/active

# Acknowledge alert
curl -X POST http://localhost:3000/api/alerts/ALT-xxx/acknowledge

# Escalate alert
curl -X POST http://localhost:3000/api/alerts/ALT-xxx/escalate

# Resolve alert
curl -X POST http://localhost:3000/api/alerts/ALT-xxx/resolve

# Get alert statistics
curl http://localhost:3000/api/alerts/stats

# Download video clip
curl http://localhost:3000/api/alerts/ALT-xxx/video -o alert.h264

# Check buffer status
curl http://localhost:3000/api/alerts/buffers/stats
```

## 🎬 How It Works

### Alert Flow

```
1. Camera detects event (fatigue, phone call, etc.)
   ↓
2. Sends 0x0200 location report with alert flags
   ↓
3. TCP Server parses alert data (Table 13-15)
   ↓
4. Alert Manager determines priority
   ↓
5. Circular Buffer saves last 30s (pre-event)
   ↓
6. Records next 30s (post-event)
   ↓
7. Sends bell notification via WebSocket
   ↓
8. Starts escalation timer
   ↓
9. If unacknowledged: Escalates after 5/10 minutes
```

### Video Capture

```
Continuous Recording (Circular Buffer)
┌─────────────────────────────────────┐
│  [30 seconds of video in memory]   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
└─────────────────────────────────────┘
                ↓ Alert Detected
┌─────────────────────────────────────┐
│  Pre-Event (30s)  │  Post-Event (30s)│
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ░░░░░░░░░░░░░░░ │
│  Saved to disk    │  Recording...    │
└─────────────────────────────────────┘
```

## 🎯 Testing

### 1. Start Server
```bash
npm run dev
```

### 2. Connect Camera
Configure camera to send to:
- TCP: `localhost:7611`
- UDP: `localhost:6611`

### 3. Start Video Stream
```bash
curl -X POST http://localhost:3000/api/vehicles/123456789012/start-live \
  -H "Content-Type: application/json" \
  -d '{"channel": 1}'
```

### 4. Open Alert Dashboard
```
http://localhost:3000/alert-dashboard.html
```

### 5. Trigger Alert
Camera sends location report with alert flags (fatigue, phone call, etc.)

### 6. Observe
- 🔔 Bell notification appears
- 📊 Stats update in real-time
- 🎬 Video clip saved to disk
- ⏱️ Escalation timer starts

## 📁 File Locations

```
recordings/
└── {vehicleId}/
    ├── channel_1_2024-01-15T10-30-00.h264  # Live recording
    └── alerts/
        ├── ALT-xxx_ch1_pre_xxx.h264        # 30s before alert
        └── ALT-xxx_ch1_post_xxx.h264       # 30s after alert

alerts.json                                  # Alert database
logs/devices.json                            # Device log
```

## 🔧 Configuration

### Escalation Timing
Edit `src/alerts/escalation.ts`:
```typescript
private rules: EscalationRule[] = [
  { delaySeconds: 300, level: 1, notifyRole: 'supervisor' },    // 5 min
  { delaySeconds: 600, level: 2, notifyRole: 'management' }     // 10 min
];
```

### Flooding Threshold
```typescript
private floodingThreshold = 10;        // alerts per minute
```

### Buffer Duration
```typescript
new CircularVideoBuffer(vehicleId, channel, 30);  // 30 seconds
```

## 📚 Documentation

- **Full Documentation**: `ALERT_SYSTEM.md`
- **Protocol Reference**: `video-doc.md`
- **Main README**: `README.md`

## 🐛 Troubleshooting

### No alerts appearing?
- Check camera is sending 0x0200 with additional info fields (0x14-0x18)
- Verify alert priority is not LOW
- Check TCP server logs for alert detection

### No pre-event video?
- Ensure video stream is active BEFORE alert
- Check buffer status: `GET /api/alerts/buffers/stats`
- Verify frames are being received in UDP server logs

### WebSocket not connecting?
- Check browser console for errors
- Verify port 3000 is accessible
- Ensure `ws` package is installed

### Escalation not working?
- Verify alert status is 'new' (not 'acknowledged')
- Check escalation timers in server logs
- Ensure priority is MEDIUM or higher

## 📞 Support

For issues or questions:
1. Check server logs
2. Review `ALERT_SYSTEM.md` for detailed documentation
3. Verify protocol implementation against `video-doc.md`

## ✨ Next Steps

1. **Test with real camera**: Connect AI telematics camera
2. **Configure terminal**: Set special alarm recording parameters (0x8103)
3. **Monitor performance**: Check buffer stats and memory usage
4. **Customize escalation**: Adjust timing and notification methods
5. **Add integrations**: Email, SMS, or external monitoring systems
