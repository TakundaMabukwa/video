# Alert Management System - Implementation Guide

## Overview

Complete implementation of priority-based alert management with 30-second pre/post event recording, escalation, and real-time notifications following JT/T 1078 protocol specifications.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    JT/T 808 TCP Server                      │
│  - Receives location reports (0x0200) with alert data      │
│  - Parses video alarms (Table 13, 14, 15)                  │
│  - Initializes circular buffers per channel                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Alert Manager                            │
│  - Priority detection (CRITICAL/HIGH/MEDIUM/LOW)            │
│  - Triggers 30s pre + 30s post video capture               │
│  - Manages alert lifecycle                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┐
        ▼                     ▼              ▼
┌──────────────┐    ┌──────────────┐  ┌──────────────┐
│   Circular   │    │  Escalation  │  │   Notifier   │
│    Buffer    │    │    Manager   │  │              │
│              │    │              │  │              │
│ - 30s video  │    │ - 5min→Sup   │  │ - Bell sound │
│ - Pre-event  │    │ - 10min→Mgmt │  │ - WebSocket  │
│ - Post-event │    │ - Flooding   │  │ - Real-time  │
└──────────────┘    └──────────────┘  └──────────────┘
```

## Protocol Implementation (JT/T 1078)

### Alert Detection (Section 5.4.1)

Alerts are received via **0x0200 Location Report** with additional information fields:

| Field ID | Description | Implementation |
|----------|-------------|----------------|
| **0x14** | Video-related alarm (Table 14) | `VideoAlarmStatus` |
| **0x15** | Signal loss per channel | `signalLossChannels[]` |
| **0x16** | Signal blocking per channel | `blockingChannels[]` |
| **0x17** | Memory failure status | `memoryFailures` |
| **0x18** | Abnormal driving behavior (Table 15) | `AbnormalDrivingBehavior` |

### Priority Mapping

Based on **Table 14** and **Table 15**:

```typescript
CRITICAL: Fatigue level > 80
HIGH:     Fatigue, Phone call, Smoking, Storage failure
MEDIUM:   Signal loss, Signal blocking, Overcrowding
LOW:      Other alerts
```

### Video Capture Methods

#### Method 1: Circular Buffer (Implemented)
- **Continuous recording** in memory (30 seconds)
- On alert: Save buffer (pre-event) + record 30s more (post-event)
- Saved to: `recordings/{vehicleId}/alerts/{alertId}_ch{N}_pre/post.h264`

#### Method 2: Query Terminal Storage (Protocol 0x9205)
```typescript
// Query recordings with alarm flag (Section 5.6.1)
sendCommand(0x9205, {
  channel: 1,
  startTime: alertTime - 30s,
  endTime: alertTime + 30s,
  alarmFlag: specific_alarm_bits,
  resourceType: 2 // video
});

// Terminal responds with 0x1205 (resource list)
// Then request playback with 0x9201
```

#### Method 3: FTP Upload (Protocol 0x9206)
```typescript
// Request file upload (Section 5.6.5)
sendCommand(0x9206, {
  ftpServer: 'ftp.example.com',
  port: 21,
  username: 'user',
  password: 'pass',
  path: '/alerts/',
  channel: 1,
  startTime: alertTime - 30s,
  endTime: alertTime + 30s,
  alarmFlag: specific_alarm_bits
});
```

## Escalation Rules

### Time-Based Escalation

| Time | Level | Action |
|------|-------|--------|
| 0 min | 0 | New alert → Notify operators |
| 5 min | 1 | Unacknowledged → Escalate to supervisor |
| 10 min | 2 | Still unacknowledged → Escalate to management |

### Alert Flooding Detection

- **Threshold**: 10 alerts per minute per vehicle
- **Action**: Immediate management notification
- **Purpose**: Detect system issues or critical situations

## API Endpoints

### Alert Management

```http
GET  /api/alerts/active              # Get all active alerts
GET  /api/alerts/:id                 # Get specific alert
POST /api/alerts/:id/acknowledge     # Acknowledge alert
POST /api/alerts/:id/escalate        # Manually escalate
POST /api/alerts/:id/resolve         # Resolve alert
GET  /api/alerts/stats               # Alert statistics
GET  /api/alerts/:id/video           # Download 60s video clip
GET  /api/alerts/buffers/stats       # Circular buffer stats
```

### WebSocket (Real-time)

```javascript
ws://localhost:3000/ws/alerts

// Message types:
{
  type: 'new_alert',
  type: 'alert_acknowledged',
  type: 'alert_escalated',
  type: 'alert_resolved',
  type: 'flooding'
}
```

## Dashboard

Access at: `http://localhost:3000/alert-dashboard.html`

Features:
- 🔔 Real-time bell notifications
- 📊 Live statistics
- 🎬 Video clip viewing
- ⚡ One-click acknowledge/escalate/resolve
- 🔴 Escalation level indicators
- 🌊 Flooding alerts

## File Structure

```
src/
├── alerts/
│   ├── alertManager.ts      # Main alert processor
│   ├── circularBuffer.ts    # 30s video buffer
│   ├── escalation.ts        # Time-based escalation
│   └── notifier.ts          # Bell notifications
├── tcp/
│   ├── server.ts            # Alert detection & buffer init
│   └── alertParser.ts       # Parse 0x0200 additional info
├── udp/
│   └── server.ts            # Feed frames to circular buffer
└── api/
    ├── routes.ts            # Alert REST endpoints
    └── websocket.ts         # Real-time notifications

recordings/
└── {vehicleId}/
    └── alerts/
        ├── ALT-xxx_ch1_pre_xxx.h264   # 30s before
        └── ALT-xxx_ch1_post_xxx.h264  # 30s after
```

## Configuration

### Special Alarm Recording (Table 7)

Configure terminal via **0x8103** command with parameter **0x0079**:

```typescript
{
  storageThreshold: 20,      // % of main memory (default 20%)
  recordingDuration: 5,      // minutes (default 5)
  preAlarmTime: 1            // minutes before alarm (default 1)
}
```

### Escalation Timing

Edit `src/alerts/escalation.ts`:

```typescript
private rules: EscalationRule[] = [
  { delaySeconds: 300, level: 1, notifyRole: 'supervisor' },
  { delaySeconds: 600, level: 2, notifyRole: 'management' }
];
```

### Flooding Threshold

```typescript
private floodingThreshold = 10;        // alerts per minute
private floodingWindowSeconds = 60;
```

## Testing

### Simulate Alert

```bash
# Send location report with alert data
curl -X POST http://localhost:3000/api/test/simulate-alert \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "123456789012",
    "alertType": "fatigue",
    "fatigueLevel": 85
  }'
```

### Monitor Buffers

```bash
curl http://localhost:3000/api/alerts/buffers/stats
```

### View Active Alerts

```bash
curl http://localhost:3000/api/alerts/active
```

## Protocol References

- **JT/T 1078-2016**: Video Communication Protocol
- **JT/T 808-2011**: Terminal Communication Protocol
- **Section 5.4.1**: Video alarm reporting
- **Section 5.6**: Historical video query/playback
- **Table 7**: Special alarm recording parameters
- **Table 13-15**: Alert type definitions

## Performance

- **Buffer memory**: ~30MB per channel (30s @ 1080p)
- **Disk I/O**: Only I-frames + alert clips
- **WebSocket**: Broadcast to all connected clients
- **Escalation**: Minimal CPU (timer-based)

## Deployment

```bash
# Install dependencies
npm install

# Build
npm run build

# Start
npm start

# Or development mode
npm run dev
```

## Monitoring

```bash
# Check alert stats
curl http://localhost:3000/api/alerts/stats

# Check buffer health
curl http://localhost:3000/api/alerts/buffers/stats

# Check server health
curl http://localhost:3000/health
```

## Troubleshooting

### No pre-event video captured
- Ensure video stream is active before alert
- Check buffer initialization: `GET /api/alerts/buffers/stats`
- Verify frames are being received: Check UDP server logs

### Escalation not triggering
- Check alert status is 'new' (not 'acknowledged')
- Verify escalation timers in logs
- Check priority level (LOW priority doesn't escalate)

### WebSocket not connecting
- Verify port 3000 is accessible
- Check browser console for errors
- Ensure ws package is installed: `npm install ws`

## Future Enhancements

1. **Terminal Storage Query**: Implement 0x9205/0x9201 for backup
2. **FTP Upload**: Add 0x9206 for bulk downloads
3. **Email/SMS**: Integrate notification services
4. **Video Conversion**: Convert H.264 to MP4 for browser playback
5. **Alert History**: Long-term storage and analytics
