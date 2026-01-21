# Alert Database Storage & Video Capture - Complete Guide

## ✅ YES - Alerts ARE Logged to Database

### Database Tables Used:

#### 1. **`alerts` Table** - Main Alert Storage
```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,                    -- Alert ID (e.g., ALT-1768814338167-12)
  device_id TEXT NOT NULL,                -- Vehicle ID (e.g., 221084138949)
  channel INTEGER NOT NULL,               -- Camera channel (1-32)
  alert_type TEXT NOT NULL,               -- "Driver Fatigue", "Phone Call", etc.
  priority TEXT NOT NULL,                 -- 'low', 'medium', 'high', 'critical'
  status TEXT NOT NULL DEFAULT 'new',    -- 'new', 'acknowledged', 'escalated', 'resolved'
  escalation_level INTEGER DEFAULT 0,     -- Escalation count
  timestamp TIMESTAMPTZ NOT NULL,         -- When alert occurred
  latitude DECIMAL(10, 8),                -- GPS latitude
  longitude DECIMAL(11, 8),               -- GPS longitude
  acknowledged_at TIMESTAMPTZ,            -- When acknowledged
  resolved_at TIMESTAMPTZ,                -- When resolved
  metadata JSONB,                         -- Full alert data including video paths
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**What's stored in `metadata` JSONB field:**
```json
{
  "videoAlarms": {
    "videoSignalLoss": true,
    "storageFailure": true
  },
  "signalLossChannels": [3, 4],
  "drivingBehavior": {
    "fatigue": true,
    "fatigueLevel": 85
  },
  "videoClips": {
    "pre": "/path/to/ALT-xxx_ch1_pre_1234567890.h264",
    "post": "/path/to/ALT-xxx_ch1_post_1234567891.h264",
    "preFrameCount": 450,
    "postFrameCount": 450,
    "preDuration": 30.2,
    "postDuration": 30.1,
    "cameraVideo": "/path/to/camera_sd_card_video.h264"
  }
}
```

#### 2. **`videos` Table** - Video File Tracking
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  device_id TEXT NOT NULL,
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,                -- Local disk path
  storage_url TEXT,                       -- Supabase/cloud URL
  file_size BIGINT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  video_type TEXT NOT NULL,               -- 'live', 'alert_pre', 'alert_post'
  alert_id TEXT,                          -- Links to alerts table
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. **`images` Table** - Screenshot Storage
```sql
CREATE TABLE images (
  id UUID PRIMARY KEY,
  device_id TEXT NOT NULL,
  channel INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  storage_url TEXT,                       -- Supabase public URL
  file_size BIGINT,
  timestamp TIMESTAMPTZ NOT NULL,
  alert_id TEXT,                          -- Links to alerts table
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📹 Video Capture: BOTH 30s Before AND After

### How It Works:

#### **Pre-Event Video (30 seconds BEFORE alert)**
1. **Circular Buffer** maintains rolling 30-second window of ALL frames
2. When alert triggers, **immediately saves last 30s** to disk
3. File: `recordings/{vehicleId}/alerts/ALT-xxx_ch{N}_pre_{timestamp}.h264`
4. Saved **instantly** - no waiting

**Example from logs:**
```
📹 Pre-event clip saved: /recordings/221084138949/alerts/ALT-1768814338167-12_ch3_pre_1737282338000.h264 
   (450 frames, 30.2s)
```

#### **Post-Event Video (30 seconds AFTER alert)**
1. After saving pre-event, **starts recording next 30s**
2. Continues collecting frames for 30 seconds
3. When complete, saves to disk
4. File: `recordings/{vehicleId}/alerts/ALT-xxx_ch{N}_post_{timestamp}.h264`
5. Updates alert record with post-event path

**Example from logs:**
```
📹 Post-event clip saved: /recordings/221084138949/alerts/ALT-1768814338167-12_ch3_post_1737282368000.h264 
   (450 frames, 30.1s)
✅ Alert ALT-1768814338167-12: Post-event video linked (450 frames, 30.1s)
```

---

## 🎥 Complete Alert Video Capture Flow

```
Alert Detected (e.g., Driver Fatigue at 10:00:00)
│
├─ 1. IMMEDIATE: Save Pre-Event Video
│  └─ Saves frames from 09:59:30 to 10:00:00 (last 30s from buffer)
│  └─ Path stored in metadata.videoClips.pre
│
├─ 2. START: Post-Event Recording
│  └─ Begins collecting frames from 10:00:00 onwards
│  └─ Records for 30 seconds (until 10:00:30)
│
├─ 3. REQUEST: Screenshot from Camera
│  └─ Sends 0x9201 command to camera
│  └─ Saves to images table with alert_id
│
├─ 4. REQUEST: Camera SD Card Video
│  └─ Sends 0x9201 command for 09:59:30 to 10:00:30
│  └─ Camera uploads video from its SD card
│  └─ More reliable than buffer (no packet loss)
│
├─ 5. AFTER 30s: Save Post-Event Video
│  └─ Saves frames from 10:00:00 to 10:00:30
│  └─ Path stored in metadata.videoClips.post
│  └─ Emits 'post-event-complete' event
│
└─ 6. UPDATE: Alert Record in Database
   └─ Updates metadata with all video paths
   └─ Alert now has complete 60s coverage (30s before + 30s after)
```

---

## 📊 Query Examples

### Get all alerts with video paths:
```sql
SELECT 
  id,
  device_id,
  alert_type,
  priority,
  timestamp,
  metadata->>'videoClips' as video_clips
FROM alerts
WHERE status != 'resolved'
ORDER BY timestamp DESC;
```

### Get alert with pre/post videos:
```sql
SELECT 
  a.*,
  v_pre.file_path as pre_video_path,
  v_post.file_path as post_video_path
FROM alerts a
LEFT JOIN videos v_pre ON v_pre.alert_id = a.id AND v_pre.video_type = 'alert_pre'
LEFT JOIN videos v_post ON v_post.alert_id = a.id AND v_post.video_type = 'alert_post'
WHERE a.id = 'ALT-1768814338167-12';
```

### Get all screenshots for an alert:
```sql
SELECT * FROM images 
WHERE alert_id = 'ALT-1768814338167-12'
ORDER BY timestamp;
```

---

## 🔍 Real Example from Your Logs

**Alert Detected:**
```
🚨 Alert ALT-1768814338167-12: Storage Failure [high]
Vehicle: 221084138949 | Time: 2026-01-19T11:19:03.000Z
Location: 26.177227, 28.119656
```

**Video Capture:**
```
📸 Requesting screenshot for alert ALT-1768814338167-12
📸 Screenshot requested from 221084138949 channel 3

🎥 Requesting 30s pre/post video for alert ALT-1768814338167-12
🎥 Alert video requested: 221084138949 ch3 
   from 2026-01-19T11:18:33.000Z to 2026-01-19T11:19:33.000Z

⚠️ No buffer for 221084138949_3, cannot capture pre-event video
   (This means circular buffer wasn't initialized yet - only camera retrieval will work)
```

**Database Record:**
```json
{
  "id": "ALT-1768814338167-12",
  "device_id": "221084138949",
  "channel": 3,
  "alert_type": "Storage Failure",
  "priority": "high",
  "status": "new",
  "timestamp": "2026-01-19T11:19:03.000Z",
  "latitude": 26.177227,
  "longitude": 28.119656,
  "metadata": {
    "videoAlarms": {
      "videoSignalLoss": true,
      "storageFailure": true
    },
    "signalLossChannels": [3, 4],
    "videoClips": {
      "cameraVideo": "pending_from_camera_sd_card"
    }
  }
}
```

---

## ✅ Summary

| Question | Answer |
|----------|--------|
| **Are alerts logged?** | ✅ YES - `alerts` table |
| **Which tables?** | `alerts`, `videos`, `images` |
| **30s before saved?** | ✅ YES - Pre-event from circular buffer |
| **30s after saved?** | ✅ YES - Post-event recording |
| **Total coverage?** | 60 seconds (30s before + 30s after) |
| **Backup source?** | Camera SD card (more reliable) |
| **Screenshot saved?** | ✅ YES - `images` table |

---

## 🎯 Key Points

1. **Dual Capture System:**
   - Circular buffer (fast, may have packet loss)
   - Camera SD card (slower, but complete)

2. **Pre-event is INSTANT:**
   - Saved immediately when alert triggers
   - No waiting required

3. **Post-event takes 30s:**
   - Must wait for 30 seconds to pass
   - Then saves and updates database

4. **All paths stored in database:**
   - `metadata.videoClips.pre`
   - `metadata.videoClips.post`
   - `metadata.videoClips.cameraVideo`

5. **Videos table tracks files:**
   - Links to alert via `alert_id`
   - Stores file size, duration, timestamps
   - Can have cloud URLs (Supabase)
