#!/bin/bash

echo "🔧 Installing server dependencies..."

# Install cors package
npm install cors
npm install @types/cors --save-dev

echo "✅ Dependencies installed"

# Check if FFmpeg is installed
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg is already installed"
    ffmpeg -version | head -n 1
else
    echo "❌ FFmpeg is NOT installed"
    echo "Run: sudo apt update && sudo apt install ffmpeg -y"
fi

echo ""
echo "📋 Next steps:"
echo "1. If FFmpeg is missing, install it: sudo apt install ffmpeg -y"
echo "2. Rebuild TypeScript: npm run build"
echo "3. Restart server: pm2 restart video-server"
echo "4. Check logs: pm2 logs video-server"
