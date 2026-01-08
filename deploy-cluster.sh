#!/bin/bash

echo "🚀 Setting up PM2 Cluster Mode for 370+ Cameras"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Build the project
echo "🔨 Building project..."
npm run build

# Stop existing instances
echo "⏹️  Stopping existing instances..."
pm2 delete video-server 2>/dev/null || true

# Start cluster mode
echo "▶️  Starting cluster mode..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo "🔧 Setting up PM2 startup..."
pm2 startup

echo ""
echo "✅ Cluster mode deployed!"
echo ""
echo "📊 Useful commands:"
echo "  pm2 status          - View all instances"
echo "  pm2 logs            - View logs"
echo "  pm2 monit           - Monitor CPU/Memory"
echo "  pm2 reload all      - Zero-downtime reload"
echo "  pm2 restart all     - Restart all instances"
echo "  pm2 stop all        - Stop all instances"
echo ""
