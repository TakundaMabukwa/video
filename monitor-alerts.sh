#!/bin/bash
# Monitor only alert and buffer-related logs

echo "🔍 Monitoring Alert & Buffer Activity..."
echo "========================================"
echo ""

pm2 logs video-server --lines 0 --raw | grep -E "(📹|🚨|✅|⚠️.*buffer|⚠️.*frames|Capturing event|clip saved|clip written|Buffer.*frames|addFrameToBuffer)"
