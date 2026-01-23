# Frontend Video Streaming Integration Guide

Complete guide for integrating JT/T 1078 video streams into your Next.js frontend.

## Server Configuration

**Video Server**: `http://164.90.182.2:3000`
- TCP Port 7611: JT/T 808 signaling + RTP video data
- UDP Port 6611: JT/T 1078 RTP (backup)
- HTTP Port 3000: REST API + HLS streaming
- CORS: Enabled for localhost:3000, localhost:3001

## Architecture Overview

```
Camera → TCP:7611 → Video Server → FFmpeg → HLS (.m3u8 + .ts)
                                              ↓
                                    Next.js Frontend → HLS.js Player
```

## Step 1: Install Dependencies

```bash
npm install hls.js
npm install --save-dev @types/hls.js
```

## Step 2: Create API Proxy Routes

Create `app/api/video/[vehicleId]/[channel]/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: { vehicleId: string; channel: string; path: string[] } }
) {
  const { vehicleId, channel, path } = params;
  const filename = path.join('/');
  
  const url = `${VIDEO_SERVER}/api/stream/${vehicleId}/${channel}/${filename}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': '*/*' },
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 
      (filename.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    );
  }
}
```

Create `app/api/vehicles/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

export async function GET() {
  const response = await fetch(`${VIDEO_SERVER}/api/vehicles`);
  const data = await response.json();
  return NextResponse.json(data);
}
```

## Step 3: Create HLS Video Player Component

Create `components/HLSPlayer.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  autoplay?: boolean;
}

export default function HLSPlayer({ vehicleId, channel, autoplay = true }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playlistUrl = `/api/video/${vehicleId}/${channel}/playlist.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10
      });

      hlsRef.current = hls;

      hls.loadSource(playlistUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('playing');
        if (autoplay) {
          video.play().catch(e => console.error('Autoplay failed:', e));
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setStatus('error');
          setError(data.type);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => hls.loadSource(playlistUrl), 3000);
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = playlistUrl;
      video.addEventListener('loadedmetadata', () => {
        setStatus('playing');
        if (autoplay) video.play();
      });
    } else {
      setStatus('error');
      setError('HLS not supported');
    }
  }, [vehicleId, channel, autoplay]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        muted
        playsInline
      />
      
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white">Loading stream...</div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-red-500">Error: {error}</div>
        </div>
      )}
    </div>
  );
}
```

## Step 4: Create Video Dashboard Page

Create `app/video/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import HLSPlayer from '@/components/HLSPlayer';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

interface Vehicle {
  id: string;
  phoneNumber: string;
  channels: number;
  connected: boolean;
  lastSeen: string;
}

interface StreamInfo {
  vehicleId: string;
  channel: number;
  active: boolean;
}

export default function VideoPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeStreams, setActiveStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles');
      const data = await res.json();
      setVehicles(data.vehicles || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      setLoading(false);
    }
  };

  const startStream = async (vehicleId: string, channel: number) => {
    try {
      const res = await fetch(`${VIDEO_SERVER}/api/vehicles/${vehicleId}/start-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel })
      });
      
      if (res.ok) {
        setActiveStreams(prev => [...prev, { vehicleId, channel, active: true }]);
      }
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  };

  const stopStream = async (vehicleId: string, channel: number) => {
    try {
      await fetch(`${VIDEO_SERVER}/api/vehicles/${vehicleId}/stop-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel })
      });
      
      setActiveStreams(prev => 
        prev.filter(s => !(s.vehicleId === vehicleId && s.channel === channel))
      );
    } catch (error) {
      console.error('Failed to stop stream:', error);
    }
  };

  const isStreamActive = (vehicleId: string, channel: number) => {
    return activeStreams.some(s => s.vehicleId === vehicleId && s.channel === channel);
  };

  if (loading) {
    return <div className="p-8">Loading vehicles...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Live Vehicle Cameras</h1>

      {vehicles.length === 0 ? (
        <div className="text-gray-500">No vehicles connected</div>
      ) : (
        <div className="space-y-8">
          {vehicles.map(vehicle => (
            <div key={vehicle.id} className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Vehicle {vehicle.id}</h2>
                  <p className="text-sm text-gray-600">
                    Phone: {vehicle.phoneNumber} | 
                    Channels: {vehicle.channels} |
                    Status: <span className={vehicle.connected ? 'text-green-600' : 'text-red-600'}>
                      {vehicle.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: vehicle.channels }, (_, i) => i + 1).map(channel => {
                  const active = isStreamActive(vehicle.id, channel);
                  
                  return (
                    <div key={channel} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">Channel {channel}</h3>
                        <button
                          onClick={() => active 
                            ? stopStream(vehicle.id, channel)
                            : startStream(vehicle.id, channel)
                          }
                          className={`px-4 py-2 rounded text-sm ${
                            active 
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          {active ? 'Stop' : 'Start'}
                        </button>
                      </div>

                      {active && (
                        <HLSPlayer 
                          vehicleId={vehicle.id} 
                          channel={channel}
                          autoplay={true}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Step 5: Test the Integration

1. **Start your Next.js dev server**:
```bash
npm run dev
```

2. **Connect a JT/T 1078 camera** to `164.90.182.2:7611`

3. **Open the dashboard**: `http://localhost:3000/video`

4. **Click "Start"** on any channel to begin streaming

## API Reference

### Get Connected Vehicles
```http
GET /api/vehicles
```

Response:
```json
{
  "vehicles": [
    {
      "id": "123456789",
      "phoneNumber": "13800138000",
      "channels": 4,
      "connected": true,
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Start Live Stream
```http
POST /api/vehicles/:vehicleId/start-live
Content-Type: application/json

{
  "channel": 1,
  "dataType": 0,
  "streamType": 0
}
```

### Stop Live Stream
```http
POST /api/vehicles/:vehicleId/stop-live
Content-Type: application/json

{
  "channel": 1
}
```

### HLS Playlist URL
```
/api/video/:vehicleId/:channel/playlist.m3u8
```

## Troubleshooting

### Stream Not Loading
1. Check camera is connected: `GET http://164.90.182.2:3000/api/vehicles`
2. Verify stream started: `POST http://164.90.182.2:3000/api/vehicles/:id/start-live`
3. Check FFmpeg is running on server: `ps aux | grep ffmpeg`
4. Verify HLS files exist: `ls -la /root/video/hls/:vehicleId/channel_:N/`

### CORS Errors
Server already has CORS enabled for:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://46.101.219.78:3000`

If deploying to production, add your domain to `src/index.ts`:
```typescript
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}));
```

### Video Lag/Buffering
Adjust HLS.js config in `HLSPlayer.tsx`:
```typescript
const hls = new Hls({
  liveSyncDurationCount: 2,  // Lower = less latency
  liveMaxLatencyDurationCount: 5,
  maxBufferLength: 10
});
```

## Production Deployment

1. **Update API proxy** to use environment variable:
```typescript
const VIDEO_SERVER = process.env.NEXT_PUBLIC_VIDEO_SERVER || 'http://164.90.182.2:3000';
```

2. **Add to `.env.local`**:
```
NEXT_PUBLIC_VIDEO_SERVER=http://164.90.182.2:3000
```

3. **Build and deploy**:
```bash
npm run build
npm start
```

## Protocol Details (JT/T 1078)

- **0x9101**: Real-time video transmission request (sent by server to camera)
- **0x1205**: Real-time audio/video transmission (camera → server via TCP:7611)
- **RTP Format**: Custom JT/T 1078 RTP over TCP (not standard RTP/UDP)
- **Video Codec**: H.264
- **Audio Codec**: G.711/AAC (if enabled)

## Server Auto-Start Behavior

The server automatically starts HLS streaming when:
1. First RTP frame arrives from camera on TCP:7611
2. Frame is successfully assembled (handles split frames)
3. FFmpeg process spawns and begins converting H.264 → HLS

No manual start command needed if camera is already sending data.
