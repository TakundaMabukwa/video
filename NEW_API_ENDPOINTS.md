# New Alert Management API Endpoints

## ✅ Requirements Implementation

### 1. **Resolve Alert with Required Notes**
```http
POST /api/alerts/:id/resolve-with-notes
Content-Type: application/json

{
  "notes": "Driver was not fatigued, false positive from camera angle",
  "resolvedBy": "operator@company.com"
}
```
**Validation:** Notes must be at least 10 characters

---

### 2. **Mark Alert as False Alert**
```http
POST /api/alerts/:id/mark-false
Content-Type: application/json

{
  "reason": "Camera glare caused false fatigue detection",
  "markedBy": "supervisor@company.com"
}
```
**Validation:** Reason must be at least 10 characters

---

### 3. **Get Unattended Alerts**
```http
GET /api/alerts/unattended?minutes=30
```
Returns alerts that haven't been actioned within specified timeframe

---

### 4. **Get Alerts Grouped by Priority**
```http
GET /api/alerts/by-priority
```
Returns:
```json
{
  "critical": [...],
  "high": [...],
  "medium": [...],
  "low": [...]
}
```

---

### 5. **Get Recent Screenshots (Auto-refresh)**
```http
GET /api/screenshots/recent?limit=50&alertsOnly=true
```
Frontend should poll this every 30 seconds

---

### 6. **Executive Dashboard Analytics**
```http
GET /api/dashboard/executive?days=30
```
Returns:
- Alerts by priority
- Alerts by type
- Average response time
- Escalation rate
- Resolution rate

---

### 7. **Record Speeding Event**
```http
POST /api/speeding/record
Content-Type: application/json

{
  "vehicleId": "221084138949",
  "driverId": "DRV001",
  "speed": 125.5,
  "speedLimit": 100,
  "latitude": 26.177227,
  "longitude": 28.119656
}
```
Auto-generates report if driver has >3 events in 7 days

---

### 8. **Get Driver Rating**
```http
GET /api/drivers/:driverId/rating
```
Returns current rating and total demerits

---

### 9. **Get Driver Speeding Events**
```http
GET /api/drivers/:driverId/speeding-events?days=7
```
Returns all speeding events for driver

---

## Testing Commands

```bash
# Rebuild
cd /root/video
npm run build

# Restart
pm2 restart all

# Test unattended alerts
curl http://localhost:3000/api/alerts/unattended?minutes=30

# Test dashboard
curl http://localhost:3000/api/dashboard/executive?days=7

# Test screenshots
curl http://localhost:3000/api/screenshots/recent?limit=10
```

## Frontend Integration Notes

1. **Auto-refresh screenshots:** Poll `/api/screenshots/recent` every 30 seconds
2. **Alert reminders:** Check `/api/alerts/unattended` every 5 minutes
3. **Dashboard:** Refresh `/api/dashboard/executive` every 60 seconds
4. **Priority grouping:** Use `/api/alerts/by-priority` for alert management screen
