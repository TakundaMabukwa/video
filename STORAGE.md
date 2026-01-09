# Storage Architecture

## PostgreSQL Tables

### 1. devices
**Stores:** Connected vehicle/camera information
**Updated by:** `DeviceStorage.upsertDevice()`
**When:** Vehicle registration (0x0100) or authentication (0x0102)
**Fields:**
- device_id (phone number)
- ip_address
- last_seen (auto-updated on each connection)

### 2. alerts
**Stores:** Alert events from location reports
**Updated by:** `AlertStorageDB.saveAlert()`, `AlertStorageDB.updateAlertStatus()`
**When:** Alert detected in 0x0200 location report
**Fields:**
- id (ALT-timestamp-counter)
- device_id
- channel
- alert_type (Driver Fatigue, Phone Call, etc.)
- priority (low/medium/high/critical)
- status (new/acknowledged/escalated/resolved)
- escalation_level
- timestamp
- latitude, longitude
- acknowledged_at, resolved_at
- metadata (JSONB - full alert details)

### 3. videos
**Stores:** Video file metadata (files on local disk + Supabase Storage)
**Updated by:** `VideoStorage.saveVideo()`, `VideoStorage.updateVideoEnd()`, `VideoStorage.uploadVideoToSupabase()`
**When:** Video recording starts/stops/uploads
**Fields:**
- id (UUID)
- device_id
- channel
- file_path (local disk path)
- storage_url (Supabase public URL)
- file_size
- start_time, end_time
- duration_seconds
- video_type (live/alert_pre/alert_post)
- alert_id (links to alerts table)

### 4. images
**Stores:** Image metadata (files in Supabase Storage)
**Updated by:** `ImageStorage.saveImage()`
**When:** 0x0801 multimedia message received or screenshot requested
**Fields:**
- id (UUID)
- device_id
- channel
- file_path (Supabase path)
- storage_url (public Supabase URL)
- file_size
- timestamp
- alert_id (links to alerts table)

## Storage Locations

### Local Disk (Temporary)
- **Videos:** `recordings/<vehicleId>/channel_<N>_<timestamp>.h264`
- **Why:** Initial write location, then uploaded to Supabase

### Supabase Storage (Permanent)
- **Videos:** `videos/<deviceId>/ch<channel>/<timestamp>.h264`
- **Images:** `videos/<deviceId>/ch<channel>/<timestamp>.jpg`
- **Why:** CDN delivery, globally accessible, public URLs, persistent storage

## Data Flow

### Alert Detection Flow
1. 0x0200 location report received
2. `AlertParser.parseLocationReport()` extracts alert data
3. `AlertManager.processAlert()` creates AlertEvent
4. `AlertStorageDB.saveAlert()` → **alerts table**
5. Screenshot requested → 0x9201 command sent
6. Image received via 0x0801 → `ImageStorage.saveImage()` → **images table** (with alert_id)
7. Video requested → 0x9201 command sent (30s before/after)
8. Video received via UDP → `VideoStorage.saveVideo()` → **videos table** (with alert_id)

### Device Connection Flow
1. 0x0100 registration or 0x0102 auth received
2. `DeviceStorage.upsertDevice()` → **devices table**
3. Updates last_seen timestamp on each connection

### Image Upload Flow
1. 0x0801 multimedia message received
2. `MultimediaParser.parseMultimediaData()` extracts JPEG
3. Upload to Supabase Storage bucket
4. `ImageStorage.saveImage()` → **images table** with storage_url

### Video Recording Flow
1. Video stream starts (live or playback)
2. `VideoStorage.saveVideo()` → **videos table** (initial record)
3. Video frames written to local disk
4. `VideoStorage.updateVideoEnd()` → updates end_time, file_size, duration
5. `VideoStorage.uploadVideoToSupabase()` → uploads to Supabase Storage
6. Updates **videos table** with storage_url

## Relationships

```
devices (1) ──→ (N) alerts
devices (1) ──→ (N) videos
devices (1) ──→ (N) images

alerts (1) ──→ (N) videos (via alert_id)
alerts (1) ──→ (N) images (via alert_id)
```

## Query Examples

### Get all alert data with media
```sql
SELECT 
  a.*,
  json_agg(DISTINCT v.*) as videos,
  json_agg(DISTINCT i.*) as images
FROM alerts a
LEFT JOIN videos v ON v.alert_id = a.id
LEFT JOIN images i ON i.alert_id = a.id
WHERE a.id = 'ALT-123456'
GROUP BY a.id;
```

### Get device with recent alerts
```sql
SELECT 
  d.*,
  COUNT(a.id) as alert_count
FROM devices d
LEFT JOIN alerts a ON a.device_id = d.device_id
  AND a.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY d.device_id;
```
