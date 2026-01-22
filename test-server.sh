#!/bin/bash

echo "🧪 Testing Video Server Setup..."
echo ""

# Test 1: FFmpeg
echo "1️⃣ Testing FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg installed: $(ffmpeg -version | head -n 1)"
else
    echo "❌ FFmpeg NOT installed"
    echo "   Run: sudo apt install ffmpeg -y"
fi

echo ""

# Test 2: Server running
echo "2️⃣ Testing server..."
if pm2 list | grep -q video-server; then
    echo "✅ Server is running"
else
    echo "❌ Server is NOT running"
    echo "   Run: pm2 start dist/index.js --name video-server"
fi

echo ""

# Test 3: API endpoints
echo "3️⃣ Testing API endpoints..."

# Test /api/vehicles
echo -n "   /api/vehicles: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/vehicles)
if [ "$RESPONSE" = "200" ]; then
    echo "✅ $RESPONSE"
else
    echo "❌ $RESPONSE"
fi

# Test /health
echo -n "   /health: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ "$RESPONSE" = "200" ]; then
    echo "✅ $RESPONSE"
else
    echo "❌ $RESPONSE"
fi

echo ""

# Test 4: Check for connected vehicles
echo "4️⃣ Checking connected vehicles..."
VEHICLES=$(curl -s http://localhost:3000/api/vehicles | grep -o '"connected":true' | wc -l)
echo "   Connected vehicles: $VEHICLES"

if [ "$VEHICLES" -gt 0 ]; then
    echo "✅ Cameras are connected"
    
    # Get first vehicle ID
    VEHICLE_ID=$(curl -s http://localhost:3000/api/vehicles | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)
    echo "   First vehicle: $VEHICLE_ID"
    
    echo ""
    echo "5️⃣ Testing stream start..."
    echo "   Starting stream for $VEHICLE_ID..."
    
    START_RESPONSE=$(curl -s -X POST http://localhost:3000/api/vehicles/$VEHICLE_ID/start-live \
        -H "Content-Type: application/json" \
        -d '{"channel": 1}')
    
    if echo "$START_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Stream started successfully"
        
        echo "   Waiting 3 seconds for HLS playlist..."
        sleep 3
        
        echo -n "   Checking HLS playlist: "
        HLS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/stream/$VEHICLE_ID/channel_1/playlist.m3u8)
        
        if [ "$HLS_RESPONSE" = "200" ]; then
            echo "✅ $HLS_RESPONSE - HLS streaming works!"
        else
            echo "❌ $HLS_RESPONSE - HLS playlist not found"
            echo "   Check logs: pm2 logs video-server | grep FFmpeg"
        fi
    else
        echo "❌ Failed to start stream"
        echo "   Response: $START_RESPONSE"
    fi
else
    echo "⚠️ No cameras connected"
    echo "   Wait for cameras to connect, then run this test again"
fi

echo ""
echo "📋 Summary:"
echo "   View logs: pm2 logs video-server --lines 50"
echo "   Test URL:  http://164.90.182.2:3000/hls-player.html"
echo ""
