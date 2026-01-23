#!/bin/bash
# EMERGENCY FIX FOR MEMORY LEAK

echo "🚨 Applying emergency memory leak fix..."

# Kill apport (crash reporter eating CPU)
echo "Killing apport process..."
pkill -9 apport

# Restart video server with memory limit
echo "Restarting video server with 1GB memory limit..."
pm2 stop video-server
pm2 delete video-server
pm2 start dist/index.js --name video-server --max-memory-restart 1G --node-args="--max-old-space-size=1024"

# Monitor
pm2 monit

echo "✅ Emergency fix applied"
echo "Memory limit: 1GB (will auto-restart if exceeded)"
