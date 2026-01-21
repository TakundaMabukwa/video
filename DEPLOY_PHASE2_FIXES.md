# Deploy Phase 2 Endpoint Fixes

## Changes Made

Fixed the following endpoints to return correct response formats:

1. **GET /api/alerts/by-priority** - Returns `alertsByPriority` and `counts` with `total`
2. **GET /api/alerts/stats** - Returns `stats` object with `byStatus` and `byPriority`
3. **GET /api/alerts/unattended** - Returns `unattendedAlerts`, `count`, `threshold_minutes`
4. **GET /api/alerts/active** - Returns `alerts` array and `count`
5. **GET /api/alerts** - Now supports query parameters: `status`, `priority`, `limit`
6. **GET /api/alerts/:id** - Returns `alert` object instead of `data`

## Deployment Steps

### 1. Upload Fixed Files to Server

Upload the updated `src/api/routes.ts` file to your server:

```bash
scp src/api/routes.ts root@164.90.182.2:/root/video/src/api/
```

Or use your preferred method (FTP, Git, etc.)

### 2. SSH into Server

```bash
ssh root@164.90.182.2
```

### 3. Navigate to Project Directory

```bash
cd /root/video
```

### 4. Rebuild TypeScript

```bash
npm run build
```

### 5. Restart PM2 Process

```bash
pm2 restart video-server
```

Or if you named it differently:

```bash
pm2 list                    # Check process name
pm2 restart <process-name>  # Restart it
```

### 6. Verify Server is Running

```bash
pm2 logs video-server --lines 50
```

Look for:
```
REST API server listening on port 3000
WebSocket - Alerts: ws://localhost:3000/ws/alerts
```

### 7. Test Endpoints

From your local machine:

```bash
# Test by-priority
curl http://164.90.182.2:3000/api/alerts/by-priority

# Test stats
curl http://164.90.182.2:3000/api/alerts/stats

# Test unattended
curl http://164.90.182.2:3000/api/alerts/unattended?minutes=30

# Test active
curl http://164.90.182.2:3000/api/alerts/active

# Test health
curl http://164.90.182.2:3000/health
```

## Quick Restart (Alternative)

If you have the code already on the server via Git:

```bash
ssh root@164.90.182.2
cd /root/video
git pull                    # If using Git
npm run build
pm2 restart video-server
pm2 logs video-server
```

## Troubleshooting

### If endpoints still return 404:

1. Check PM2 is running:
   ```bash
   pm2 status
   ```

2. Check logs for errors:
   ```bash
   pm2 logs video-server --err
   ```

3. Verify port 3000 is listening:
   ```bash
   netstat -tlnp | grep 3000
   ```

4. Check firewall (should already be open):
   ```bash
   ufw status
   ```

### If build fails:

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

### If PM2 process is stuck:

```bash
pm2 delete video-server
pm2 start dist/index.js --name video-server
```

## Expected Response Formats

### /api/alerts/by-priority
```json
{
  "success": true,
  "alertsByPriority": {
    "critical": [...],
    "high": [...],
    "medium": [...],
    "low": [...]
  },
  "counts": {
    "critical": 2,
    "high": 5,
    "medium": 3,
    "low": 1,
    "total": 11
  }
}
```

### /api/alerts/stats
```json
{
  "success": true,
  "stats": {
    "total": 45,
    "byStatus": {
      "new": 12,
      "acknowledged": 8,
      "escalated": 3,
      "resolved": 22
    },
    "byPriority": {
      "critical": 5,
      "high": 15,
      "medium": 20,
      "low": 5
    }
  }
}
```

### /api/alerts/unattended
```json
{
  "success": true,
  "unattendedAlerts": [...],
  "count": 3,
  "threshold_minutes": 30
}
```

## Files Changed

- `src/api/routes.ts` - Fixed 6 endpoint response formats

## No Database Changes Required

All changes are code-only, no schema migrations needed.
