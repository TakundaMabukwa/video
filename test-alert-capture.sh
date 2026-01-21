#!/bin/bash
# Test alert video capture

VEHICLE_ID="221083639541"

echo "🧪 Testing Alert Video Capture"
echo "==============================="
echo ""

# Check buffer status before
echo "1️⃣ Buffer status BEFORE alert:"
curl -s http://localhost:3000/api/buffers/status | jq '.data[] | select(.stream | contains("'$VEHICLE_ID'"))'
echo ""

# Trigger alert
echo "2️⃣ Triggering test alert..."
RESPONSE=$(curl -s -X POST http://localhost:3000/test/simulate-alert \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "'$VEHICLE_ID'",
    "channel": 1,
    "alertType": "fatigue",
    "fatigueLevel": 85
  }')

echo "$RESPONSE" | jq '.'
ALERT_ID=$(echo "$RESPONSE" | jq -r '.alert.id')
echo ""
echo "Alert ID: $ALERT_ID"
echo ""

# Wait a moment
echo "3️⃣ Waiting 3 seconds..."
sleep 3

# Check the alert files
echo ""
echo "4️⃣ Checking alert video files:"
ls -lh /root/video/recordings/$VEHICLE_ID/alerts/ | grep "$ALERT_ID" | tail -5
echo ""

# Check buffer status after
echo "5️⃣ Buffer status AFTER alert:"
curl -s http://localhost:3000/api/buffers/status | jq '.data[] | select(.stream | contains("'$VEHICLE_ID'"))'
