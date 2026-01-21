# WebSocket Connection Issue - Quick Fix

## Problem
Cannot connect to `ws://164.90.182.2:3000/ws/alerts`

## Root Cause
**Port 3000 is blocked by DigitalOcean Cloud Firewall**

The WebSocket server is running correctly, but external connections are blocked.

## Solution (2 minutes)

### Step 1: Open Firewall Port
1. Go to [DigitalOcean Dashboard](https://cloud.digitalocean.com)
2. Click **Networking** → **Firewalls**
3. Select your firewall
4. Under **Inbound Rules**, click **Add Rule**
5. Configure:
   - **Type:** Custom
   - **Protocol:** TCP
   - **Port Range:** 3000
   - **Sources:** All IPv4 + All IPv6
6. Click **Save**

### Step 2: Test Connection

**Option A: Browser Console**
```javascript
const ws = new WebSocket('ws://164.90.182.2:3000/ws/alerts');
ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📨', e.data);
```

**Option B: Test Page**
Visit: `http://164.90.182.2:3000/websocket-test.html`

**Option C: Node.js Script**
```bash
node test-websocket.js
```

## Expected Result

When connected, you should receive:
```json
{
  "type": "connected",
  "message": "Connected to alert notification system",
  "timestamp": "2026-01-20T18:09:19.000Z"
}
```

## WebSocket Events

Once connected, you'll receive:

| Event | Description | Frequency |
|-------|-------------|-----------|
| `connected` | Initial connection | Once |
| `new_alert` | New alert created | Real-time |
| `alert_acknowledged` | Alert acknowledged | Real-time |
| `alert_escalated` | Alert escalated | Real-time |
| `alert_resolved` | Alert resolved | Real-time |
| `alert-reminder` | Unattended alerts | Every 5 min |

## Frontend Integration

```javascript
const ws = new WebSocket('ws://164.90.182.2:3000/ws/alerts');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'new_alert':
      showNotification('New Alert!', data.data);
      break;
    case 'alert-reminder':
      showReminder(`${data.count} alerts need attention`);
      break;
  }
};
```

## Files Created

1. **public/websocket-test.html** - Interactive test page
2. **test-websocket.js** - Node.js test script
3. **WEBSOCKET_TROUBLESHOOTING.md** - Detailed troubleshooting guide

## Verify Server is Running

```bash
ssh root@164.90.182.2
pm2 logs video-server | grep -i websocket
```

Should show:
```
🔔 WebSocket alert notification server initialized
WebSocket - Alerts: ws://localhost:3000/ws/alerts
```

## Still Not Working?

Check:
1. ✅ Server running: `pm2 status`
2. ✅ Port listening: `netstat -tlnp | grep 3000`
3. ✅ HTTP works: `curl http://164.90.182.2:3000/health`
4. ✅ Firewall open: Check DigitalOcean dashboard

If HTTP works but WebSocket doesn't = **Firewall issue**

## Quick Test Commands

```bash
# Test HTTP (should work)
curl http://164.90.182.2:3000/health

# Test WebSocket (needs wscat: npm install -g wscat)
wscat -c ws://164.90.182.2:3000/ws/alerts
```

---

**TL;DR:** Open port 3000 in DigitalOcean Cloud Firewall, then test with browser console or test page.
