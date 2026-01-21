# WebSocket Connection Troubleshooting

## Problem
Cannot connect to WebSocket at `ws://164.90.182.2:3000/ws/alerts`

## Quick Test

### Option 1: Use Test Page
1. Upload `public/websocket-test.html` to server
2. Visit: `http://164.90.182.2:3000/websocket-test.html`
3. Click "Connect" button
4. Check messages for connection status

### Option 2: Browser Console Test
Open browser console and run:
```javascript
const ws = new WebSocket('ws://164.90.182.2:3000/ws/alerts');
ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📨 Message:', e.data);
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = (e) => console.log('🔌 Closed:', e.code, e.reason);
```

## Common Issues & Solutions

### 1. Firewall Blocking WebSocket
**Symptom:** Connection timeout or immediate close

**Solution:**
```bash
ssh root@164.90.182.2

# Check if port 3000 is open
ufw status

# If not listed, add it:
ufw allow 3000/tcp
ufw reload

# Verify
ufw status numbered
```

### 2. DigitalOcean Cloud Firewall
**Symptom:** HTTP works but WebSocket doesn't

**Solution:**
1. Go to DigitalOcean Dashboard
2. Navigate to: Networking → Firewalls
3. Select your firewall
4. Add Inbound Rule:
   - Type: Custom
   - Protocol: TCP
   - Port: 3000
   - Sources: All IPv4, All IPv6
5. Save

### 3. Server Not Running
**Symptom:** Connection refused

**Check:**
```bash
ssh root@164.90.182.2
pm2 status
pm2 logs video-server --lines 50
```

**Fix:**
```bash
cd /root/video
pm2 restart video-server
```

### 4. Wrong WebSocket Path
**Symptom:** 404 error

**Available WebSocket Endpoints:**
- `ws://164.90.182.2:3000/ws/alerts` - Alert notifications
- `ws://164.90.182.2:3000/ws/data` - Data stream
- `ws://164.90.182.2:3000/ws/video` - Live video stream

### 5. HTTPS/WSS Issue
**Symptom:** Mixed content error on HTTPS site

**Solution:**
If your frontend is on HTTPS, you need WSS (WebSocket Secure):
- Set up nginx reverse proxy with SSL
- Or use Cloudflare tunnel
- Or access via HTTP (not HTTPS)

## Verify Server Configuration

SSH into server and check:

```bash
# 1. Check server is listening
netstat -tlnp | grep 3000

# Should show:
# tcp  0  0  0.0.0.0:3000  0.0.0.0:*  LISTEN  <pid>/node

# 2. Check PM2 logs
pm2 logs video-server --lines 100 | grep -i websocket

# Should show:
# 🔔 WebSocket alert notification server initialized
# WebSocket - Alerts: ws://localhost:3000/ws/alerts

# 3. Test locally on server
curl http://localhost:3000/health

# 4. Test WebSocket upgrade (should return 101)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:3000/ws/alerts
```

## Test from External Machine

```bash
# Test HTTP (should work)
curl http://164.90.182.2:3000/health

# Test WebSocket with wscat (install: npm install -g wscat)
wscat -c ws://164.90.182.2:3000/ws/alerts

# Or with websocat (install: cargo install websocat)
websocat ws://164.90.182.2:3000/ws/alerts
```

## Expected Behavior

When WebSocket connects successfully:

1. **Server logs show:**
   ```
   🔌 WebSocket client connected
   ```

2. **Client receives:**
   ```json
   {
     "type": "connected",
     "message": "Connected to alert notification system",
     "timestamp": "2026-01-20T18:09:19.000Z"
   }
   ```

3. **Client stays connected** and receives events:
   - `new_alert` - When new alert created
   - `alert_acknowledged` - When alert acknowledged
   - `alert_escalated` - When alert escalated
   - `alert_resolved` - When alert resolved
   - `alert-reminder` - Every 5 minutes if unattended alerts exist

## Frontend Integration Example

```javascript
class AlertWebSocket {
  constructor(url = 'ws://164.90.182.2:3000/ws/alerts') {
    this.url = url;
    this.ws = null;
    this.reconnectInterval = 5000;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket closed, reconnecting...');
      setTimeout(() => this.connect(), this.reconnectInterval);
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('Connected:', data.message);
        break;
      case 'new_alert':
        this.onNewAlert(data.data);
        break;
      case 'alert-reminder':
        this.onReminder(data.count, data.alerts);
        break;
      default:
        console.log('Message:', data);
    }
  }

  onNewAlert(alert) {
    // Show notification
    console.log('🚨 New alert:', alert);
  }

  onReminder(count, alerts) {
    // Show reminder notification
    console.log(`⏰ ${count} unattended alerts!`);
  }
}

// Usage
const alertWS = new AlertWebSocket();
alertWS.connect();
```

## Most Likely Issue

**Port 3000 is blocked by DigitalOcean Cloud Firewall**

Fix:
1. Go to DigitalOcean Dashboard
2. Networking → Firewalls
3. Add TCP port 3000 inbound rule
4. Test: `curl http://164.90.182.2:3000/health`
5. Test WebSocket: Use test page or browser console

## Need Help?

If still not working, provide:
1. Output of: `curl http://164.90.182.2:3000/health`
2. Browser console error when connecting to WebSocket
3. Output of: `pm2 logs video-server --lines 50`
