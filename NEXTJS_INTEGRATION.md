# Next.js Integration Guide

## Current Video Server Setup

### HLS Files Location
- **Directory**: `hls/<vehicleId>/channel_<N>/`
- **Playlist**: `hls/<vehicleId>/channel_<N>/playlist.m3u8`
- **Segments**: `hls/<vehicleId>/channel_<N>/*.ts`

### Server Routes (routes.ts)
```typescript
// Serve HLS playlist
router.get('/stream/:vehicleId/:channel/playlist.m3u8', (req, res) => {
  const { vehicleId, channel } = req.params;
  const playlistPath = path.join(process.cwd(), 'hls', vehicleId, `channel_${channel}`, 'playlist.m3u8');
  res.sendFile(playlistPath);
});

// Serve HLS segments
router.get('/stream/:vehicleId/:channel/:segment', (req, res) => {
  const { vehicleId, channel, segment } = req.params;
  const segmentPath = path.join(process.cwd(), 'hls', vehicleId, `channel_${channel}`, segment);
  res.sendFile(segmentPath);
});
```

### Static Directory (index.ts)
```typescript
app.use('/hls', express.static('hls'));
```

## Next.js Proxy Configuration

### Option 1: Proxy via `/api/stream/...` (Recommended)

**File**: `src/app/api/hls-proxy/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const VIDEO_SERVER = 'http://164.90.182.2:3000';

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  
  // Forward to video server's /api/stream endpoint
  const url = `${VIDEO_SERVER}/api/stream/${path}`;
  
  console.log(`[HLS Proxy] ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      console.error(`[HLS Proxy] Error ${response.status}: ${url}`);
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: response.status }
      );
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
    console.error('[HLS Proxy] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stream' },
      { status: 500 }
    );
  }
}
```

### Option 2: Direct Access (No Proxy)

**Enable CORS on Video Server** - Add to `src/index.ts`:

```typescript
import cors from 'cors';

app.use(cors({
  origin: ['http://localhost:3001', 'https://your-nextjs-app.com'],
  credentials: true
}));
```

**HLS Player Component** - Use direct URLs:

```typescript
const hlsUrl = `http://164.90.182.2:3000/api/stream/${vehicleId}/channel_${channel}/playlist.m3u8`;
```

## HLS Player Component

**File**: `src/components/video/HLSPlayer.tsx`

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  vehicleId: string;
  channel: number;
  useProxy?: boolean; // true = use Next.js proxy, false = direct
}

export default function HLSPlayer({ vehicleId, channel, useProxy = true }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Choose URL based on proxy setting
    const hlsUrl = useProxy
      ? `/api/hls-proxy/${vehicleId}/channel_${channel}/playlist.m3u8`
      : `http://164.90.182.2:3000/api/stream/${vehicleId}/channel_${channel}/playlist.m3u8`;

    console.log(`[HLS Player] Loading: ${hlsUrl}`);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log(`[HLS Player] Manifest parsed: ${vehicleId}_ch${channel}`);
        setStatus('playing');
        video.play().catch(e => {
          console.warn('Autoplay blocked:', e);
          setError('Click to play');
        });
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

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setStatus('playing');
      });
      video.addEventListener('error', () => {
        setStatus('error');
        setError('Playback error');
      });
    } else {
      setStatus('error');
      setError('HLS not supported');
    }
  }, [vehicleId, channel, useProxy]);

  return (
    <div className="relative">
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

## Testing Steps

### 1. Test Video Server Directly
```bash
# Check if stream exists
curl -I http://164.90.182.2:3000/api/stream/221083721646/channel_1/playlist.m3u8

# Should return 200 OK if stream is active
```

### 2. Test Next.js Proxy
```bash
# From your Next.js app
curl http://localhost:3001/api/hls-proxy/221083721646/channel_1/playlist.m3u8
```

### 3. Start Stream First
Before loading the player, ensure the stream is started:

```typescript
// Call this before rendering HLSPlayer
await fetch('http://164.90.182.2:3000/api/vehicles/221083721646/start-live', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ channel: 1 })
});

// Wait 2-3 seconds for FFmpeg to generate playlist
await new Promise(resolve => setTimeout(resolve, 3000));

// Now render HLSPlayer
```

## Common Issues

### 404 Error
- **Cause**: Stream not started or FFmpeg not running
- **Fix**: Call `/api/vehicles/:id/start-live` first

### CORS Error
- **Cause**: Direct access without CORS enabled
- **Fix**: Use Next.js proxy or enable CORS on video server

### Empty Playlist
- **Cause**: FFmpeg hasn't generated segments yet
- **Fix**: Wait 2-3 seconds after starting stream

### Stream Stops
- **Cause**: No video data from camera
- **Fix**: Check if camera is sending RTP packets (check server logs)

## URL Mapping

| Frontend Request | Next.js Proxy | Video Server |
|-----------------|---------------|--------------|
| `/api/hls-proxy/221083721646/channel_1/playlist.m3u8` | → | `/api/stream/221083721646/channel_1/playlist.m3u8` |
| `/api/hls-proxy/221083721646/channel_1/segment0.ts` | → | `/api/stream/221083721646/channel_1/segment0.ts` |

## Complete Flow

```
Camera → UDP:6611 → Video Server → FFmpeg → HLS Files
                                              ↓
                                    hls/221083721646/channel_1/
                                              ↓
                                    /api/stream/... (Express route)
                                              ↓
                                    Next.js Proxy (/api/hls-proxy/...)
                                              ↓
                                    HLS.js Player → Browser
```
