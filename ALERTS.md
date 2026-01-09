# Alert System Documentation

## Alert Types

### Driver Behavior Alerts
1. **Driver Fatigue** (Priority: CRITICAL if level > 80, else HIGH)
   - Detected from 0x0200 location report field 0x18
   - Includes fatigue level (0-100)
   - Auto-captures screenshot + 30s pre/post video

2. **Phone Call While Driving** (Priority: HIGH)
   - Detected from 0x0200 location report field 0x18
   - Auto-captures screenshot + 30s pre/post video

3. **Smoking While Driving** (Priority: HIGH)
   - Detected from 0x0200 location report field 0x18
   - Auto-captures screenshot + 30s pre/post video

### Video System Alerts
4. **Video Signal Loss** (Priority: MEDIUM)
   - Detected from 0x0200 location report field 0x15
   - Lists affected channels

5. **Video Signal Blocked** (Priority: MEDIUM)
   - Detected from 0x0200 location report field 0x16
   - Lists affected channels

6. **Storage Failure** (Priority: HIGH)
   - Detected from 0x0200 location report field 0x14
   - Camera SD card or memory failure

7. **Bus Overcrowding** (Priority: MEDIUM)
   - Detected from 0x0200 location report field 0x14
   - Passenger count threshold exceeded

## Alert Priority Levels

- **CRITICAL**: Fatigue level > 80
- **HIGH**: Fatigue, phone call, smoking, storage failure
- **MEDIUM**: Signal loss, signal blocking, overcrowding
- **LOW**: Other alerts (not processed)

## Alert Status Flow

```
new → acknowledged → resolved
  ↓
escalated (after 5min unacknowledged)
  ↓
escalated (after 10min total - notify management)
```

## API Endpoints

### Alert Management

#### GET /api/alerts
Get all alerts with optional filtering
```
Query params:
  - priority: low|medium|high|critical
  - status: new|acknowledged|escalated|resolved
  - device_id: vehicle phone number
  - limit: number (default 100)

Response:
{
  "success": true,
  "total": 25,
  "data": [...]
}
```

#### GET /api/alerts/by-priority
Get alerts grouped by priority (unresolved only)
```
Response:
{
  "success": true,
  "data": [
    {
      "priority": "critical",
      "count": 3,
      "alerts": [...]
    },
    ...
  ]
}
```

#### GET /api/alerts/history
Get complete alert history
```
Query params:
  - device_id: filter by vehicle (optional)
  - days: lookback period (default 7)

Response:
{
  "success": true,
  "total": 150,
  "data": [...]
}
```

#### GET /api/alerts/unresolved
Get all unresolved alerts with time open
```
Response:
{
  "success": true,
  "total": 12,
  "data": [
    {
      "id": "ALT-123456",
      "minutes_open": 15.5,
      "screenshot_count": 2,
      ...
    }
  ]
}
```

#### GET /api/alerts/driver-behavior
Get driver behavior alerts only
```
Response:
{
  "success": true,
  "total": 8,
  "data": [...]
}
```

#### GET /api/alerts/by-device
Get alerts grouped by device with statistics
```
Response:
{
  "success": true,
  "total": 5,
  "data": [
    {
      "device_id": "221084138949",
      "total_alerts": 15,
      "new_alerts": 3,
      "acknowledged_alerts": 8,
      "escalated_alerts": 2,
      "critical_alerts": 1,
      "high_alerts": 5,
      "last_alert_time": "2024-01-15T10:30:00Z",
      "recent_alerts": [...]  
    }
  ]
}
```

#### GET /api/alerts/:id
Get single alert details
```
Response:
{
  "success": true,
  "data": {
    "id": "ALT-123456",
    "device_id": "221084138949",
    "alert_type": "Driver Fatigue",
    "priority": "critical",
    "status": "new",
    ...
  }
}
```

#### GET /api/alerts/:id/media
Get alert with all screenshots and videos
```
Response:
{
  "success": true,
  "data": {
    "alert": {...},
    "screenshots": [
      {
        "id": "uuid",
        "storage_url": "https://...",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "videos": [
      {
        "id": "uuid",
        "video_type": "alert_pre",
        "storage_url": "https://...",
        "duration_seconds": 30
      }
    ]
  }
}
```

#### POST /api/alerts/:id/acknowledge
Acknowledge an alert
```
Response:
{
  "success": true,
  "message": "Alert ALT-123456 acknowledged"
}
```

#### POST /api/alerts/:id/resolve
Resolve an alert
```
Response:
{
  "success": true,
  "message": "Alert ALT-123456 resolved"
}
```

### Screenshots

#### GET /api/alerts/screenshots/all
Get all screenshots with auto-refresh support
```
Query params:
  - limit: number (default 50)
  - alert_only: true|false (default false)

Response:
{
  "success": true,
  "total": 50,
  "data": [
    {
      "id": "uuid",
      "device_id": "221084138949",
      "channel": 1,
      "storage_url": "https://...",
      "alert_id": "ALT-123456",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## WebSocket Real-Time Notifications

Connect to: `ws://localhost:3000/ws/alerts`

### Events Received

#### alert
New alert detected
```json
{
  "type": "alert",
  "data": {
    "id": "ALT-123456",
    "vehicleId": "221084138949",
    "priority": "critical",
    "type": "Driver Fatigue",
    ...
  }
}
```

#### alert-acknowledged
Alert acknowledged
```json
{
  "type": "alert-acknowledged",
  "data": {...}
}
```

#### alert-escalated
Alert escalated
```json
{
  "type": "alert-escalated",
  "data": {
    "escalationLevel": 1,
    ...
  }
}
```

#### alert-resolved
Alert resolved
```json
{
  "type": "alert-resolved",
  "data": {...}
}
```

#### notification
Bell notification
```json
{
  "type": "notification",
  "data": {
    "title": "🚨 CRITICAL Alert",
    "message": "Driver Fatigue detected",
    "priority": "critical"
  }
}
```

## Alert Features Implemented

✅ Screenshots displayed on single page  
✅ Auto-refresh every 30 seconds (client-side polling)  
✅ Alerts grouped by priority  
✅ Alert reminder notifications (unresolved endpoint)  
✅ Complete alert history with timestamps  
✅ 30s before + 30s after video recording  
✅ Bell notifications for new/escalated alerts  
✅ Escalation process (5min → supervisor, 10min → management)  

## Usage Examples

### Get all critical alerts
```bash
curl "http://localhost:3000/api/alerts?priority=critical"
```

### Get unresolved alerts for reminders
```bash
curl "http://localhost:3000/api/alerts/unresolved"
```

### Get driver fatigue alerts
```bash
curl "http://localhost:3000/api/alerts/driver-behavior"
```

### Acknowledge alert
```bash
curl -X POST "http://localhost:3000/api/alerts/ALT-123456/acknowledge"
```

### Get alert with screenshots and videos
```bash
curl "http://localhost:3000/api/alerts/ALT-123456/media"
```
