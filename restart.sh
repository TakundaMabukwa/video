#!/bin/bash
# Clean restart of video server

echo "🔄 Restarting video server..."

# Stop and delete all processes
pm2 delete all 2>/dev/null

# Start fresh single instance
pm2 start dist/index.js \
  --name video-server \
  -i 1 \
  --log-date-format="YYYY-MM-DD HH:mm:ss" \
  --merge-logs

echo ""
echo "✅ Server restarted"
pm2 list
echo ""
echo "📝 To monitor alerts only, run:"
echo "   bash monitor-alerts.sh"
echo ""
echo "🧪 To test alert capture, run:"
echo "   bash test-alert-capture.sh"
