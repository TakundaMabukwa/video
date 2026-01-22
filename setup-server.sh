#!/bin/bash

echo "🚀 Setting up video server for Next.js streaming..."
echo ""

# 1. Install FFmpeg
echo "📦 Step 1: Installing FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg already installed: $(ffmpeg -version | head -n 1)"
else
    echo "Installing FFmpeg..."
    sudo apt update
    sudo apt install ffmpeg -y
    
    if command -v ffmpeg &> /dev/null; then
        echo "✅ FFmpeg installed successfully"
    else
        echo "❌ FFmpeg installation failed"
        exit 1
    fi
fi

echo ""

# 2. Install Node packages
echo "📦 Step 2: Installing Node.js dependencies..."
npm install cors
npm install @types/cors --save-dev

echo "✅ Dependencies installed"
echo ""

# 3. Rebuild TypeScript
echo "🔨 Step 3: Building TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""

# 4. Restart server
echo "🔄 Step 4: Restarting server..."
pm2 restart video-server

if [ $? -eq 0 ]; then
    echo "✅ Server restarted"
else
    echo "⚠️ PM2 restart failed, trying to start..."
    pm2 start dist/index.js --name video-server
fi

echo ""

# 5. Show status
echo "📊 Server Status:"
pm2 list | grep video-server

echo ""
echo "📋 Verification Commands:"
echo "  Check logs:     pm2 logs video-server --lines 50"
echo "  Test API:       curl http://localhost:3000/api/vehicles"
echo "  Test FFmpeg:    ffmpeg -version"
echo ""
echo "✅ Setup complete! Server is ready for Next.js streaming."
