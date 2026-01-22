# Complete Streaming Setup Guide

## Step 1: Install FFmpeg on Video Server

SSH into your video server:
```bash
ssh root@164.90.182.2
```

Install FFmpeg:
```bash
apt update
apt install ffmpeg -y
```

Verify installation:
```bash
ffmpeg -version
# Should show: ffmpeg version 4.x or higher
```

## Step 2: Enable CORS on Video Server

Add CORS to your video server to allow Next.js to access it.

**File**: `src/index.ts` (add after line 96)

```typescript
import cors from 'cors';

// Add this line after: const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://your-nextjs-domain.com'],
  credentials: true
}));
```

Install cors package:
```bash
cd /root/video
npm install cors
npm install @types/cors --save-dev
```

Restart server:
```bash
pm2 restart video-server
pm2 logs video-server --lines 50
```

## Step 3: Test Video Server Endpoints

### Check if cameras are connected:
```bash
curl http://164.90.182.2:3000/api/vehicles
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "221083721646",
      "phone": "221083721646",
      "connected": true,
      "channels": [{"logicalChannel": 1, "type": "video"}]
    }
  ]
}
```

### Start a video stream:
```bash
curl -X POST http://164.90.182.2:3000/api/vehicles/221083721646/start-live \
  -H "Content-Type: application/json" \
  -d '{"channel": 1}'
```

Expected response:
```json
{
  "success": true,
  "message": "Video stream started for vehicle 221083721646, channel 1"
}
```

### Wait 3 seconds, then check if HLS playlist exists:
```bash
sleep 3
curl -I http://164.90.182.2:3000/api/stream/221083721646/channel_1/playlist.m3u8
```

Expected response:
```
HTTP/1.1 200 OK
Content-Type: application/vnd.apple.mpegurl
```

If you get **404**, check server logs:
```bash
pm2 logs video-server --lines 100
```

Look for:
- `🎬 HLS stream started: 221083721646_1`
- `🎬 Starting FFmpeg HLS stream`
- `✅ FFmpeg process started`

## Step 4: Next.js Frontend Setup

### Install dependencies:
```bash
cd /path/to/your/nextjs/app
npm install hls.js
npm install @types/hls.js --save-dev
```

### Create API proxy route:

**File**: `src/app/api/hls-proxy/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const url = `${VIDEO_SERVER}/api/stream/${path}`;
  
  console.log(`[HLS Proxy] ${url}`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      console.error(`[HLS Proxy] ${response.status}: ${url}`);
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    const contentType = path.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : path.endsWith('.ts')
      ? 'video/MP2T'
      : 'application/octet-stream';

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[HLS Proxy] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}
```

### Create vehicle list API:

**File**: `src/app/api/video-vehicles/route.ts`

```typescript
import { NextResponse } from 'next/server';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

export async function GET() {
  try {
    const response = await fetch(`${VIDEO_SERVER}/api/vehicles`, {
      cache: 'no-store'
    });
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      vehicles: data.data || []
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}
```

### Create start stream API:

**File**: `src/app/api/video-stream/start/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

export async function POST(req: NextRequest) {
  try {
    const { vehicleId, channel } = await req.json();
    
    const response = await fetch(
      `${VIDEO_SERVER}/api/vehicles/${vehicleId}/start-live`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel })
      }
    );
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to start stream' },
      { status: 500 }
    );
  }
}
```

### Create HLS Player Component:

**File**: `src/components/HLSPlayer.tsx`

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
}

export default function HLSPlayer({ vehicleId, channel }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hlsUrl = `/api/hls-proxy/${vehicleId}/channel_${channel}/playlist.m3u8`;
    console.log(`[HLS Player] Loading: ${hlsUrl}`);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`[HLS Player] ✅ Stream ready: ${vehicleId}_ch${channel}`);
        setStatus('playing');
        video.play().catch(e => console.warn('Autoplay blocked:', e));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error(`[HLS Player] Error:`, data);
        if (data.fatal) {
          setStatus('error');
          setError(data.type === 'networkError' ? 'Network error' : 'Media error');
          
          // Retry after 5 seconds
          setTimeout(() => {
            console.log(`[HLS Player] Retrying...`);
            setStatus('loading');
            hls.loadSource(hlsUrl);
          }, 5000);
        }
      });

      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => setStatus('playing'));
      video.addEventListener('error', () => {
        setStatus('error');
        setError('Playback error');
      });
    } else {
      setStatus('error');
      setError('HLS not supported');
    }
  }, [vehicleId, channel]);

  return (
    <div className="relative w-full">
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        className="w-full h-auto bg-black rounded"
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Loading stream...</div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-red-500">{error}</div>
        </div>
      )}
    </div>
  );
}
```

### Create Video Dashboard Page:

**File**: `src/app/dashboard/video/page.tsx`

```typescript
'use client';
import { useEffect, useState } from 'react';
import HLSPlayer from '@/components/HLSPlayer';

interface Vehicle {
  id: string;
  phone: string;
  connected: boolean;
  channels: { logicalChannel: number }[];
}

export default function VideoPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeStreams, setActiveStreams] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchVehicles() {
    const res = await fetch('/api/video-vehicles');
    const data = await res.json();
    if (data.success) setVehicles(data.vehicles);
  }

  async function startStream(vehicleId: string, channel: number) {
    const key = `${vehicleId}_${channel}`;
    
    // Start stream on video server
    await fetch('/api/video-stream/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId, channel })
    });
    
    // Wait for FFmpeg to generate playlist
    await new Promise(r => setTimeout(r, 3000));
    
    setActiveStreams(prev => new Set(prev).add(key));
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Live Video Streams</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {vehicles.map(vehicle => (
          <div key={vehicle.id} className="border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Vehicle: {vehicle.id}</h2>
            
            {vehicle.channels?.map(ch => {
              const streamKey = `${vehicle.id}_${ch.logicalChannel}`;
              const isActive = activeStreams.has(streamKey);
              
              return (
                <div key={ch.logicalChannel} className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span>Channel {ch.logicalChannel}</span>
                    {!isActive && (
                      <button
                        onClick={() => startStream(vehicle.id, ch.logicalChannel)}
                        className="px-4 py-2 bg-blue-500 text-white rounded"
                      >
                        Start Stream
                      </button>
                    )}
                  </div>
                  
                  {isActive && (
                    <HLSPlayer vehicleId={vehicle.id} channel={ch.logicalChannel} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {vehicles.length === 0 && (
        <div className="text-center text-gray-500 mt-10">
          No vehicles connected. Waiting for cameras...
        </div>
      )}
    </div>
  );
}
```

## Step 5: Test Complete Flow

1. **Check video server logs**:
```bash
pm2 logs video-server --lines 50
```

2. **Start Next.js dev server**:
```bash
npm run dev
```

3. **Open browser**: `http://localhost:3000/dashboard/video`

4. **Click "Start Stream"** on a vehicle

5. **Check browser console** for:
   - `[HLS Player] Loading: /api/hls-proxy/...`
   - `[HLS Player] ✅ Stream ready`

6. **Video should play** within 5-10 seconds

## Troubleshooting

### 404 on playlist.m3u8
- FFmpeg not installed: `apt install ffmpeg`
- Stream not started: Click "Start Stream" button
- Check logs: `pm2 logs video-server`

### CORS errors
- Add CORS to video server (Step 2)
- Restart: `pm2 restart video-server`

### Black screen / no video
- Camera not connected: Check `/api/vehicles`
- No RTP data: Check server logs for "Frame assembled"
- FFmpeg error: Check logs for "FFmpeg error"

### Stream stops after few seconds
- Camera stopped sending data
- Network issue between camera and server
- Check: `pm2 logs video-server | grep RTP`

## Summary

**Video Server** (164.90.182.2):
- Receives RTP from cameras via TCP
- FFmpeg converts to HLS
- Serves via `/api/stream/...`

**Next.js Frontend**:
- Proxies HLS via `/api/hls-proxy/...`
- HLS.js plays video in browser
- No FFmpeg needed on frontend

**Complete Flow**:
```
Camera → TCP:7611 → Video Server → FFmpeg → HLS files
                                                ↓
                                    /api/stream/...
                                                ↓
                                    Next.js Proxy
                                                ↓
                                    HLS.js → Browser
```
