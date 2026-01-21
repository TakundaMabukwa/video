# Next.js Video Streaming Integration Guide

Complete guide for integrating JT/T 1078 video streams into your Next.js application.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Endpoints](#api-endpoints)
3. [Next.js Implementation](#nextjs-implementation)
4. [Video Player Component](#video-player-component)
5. [WebSocket Integration](#websocket-integration)
6. [Production Deployment](#production-deployment)

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  AI Cameras     │ ──RTP──> ┌──────────────────┐
│  (JT/T 1078)    │          │  Video Server    │
└─────────────────┘          │  (Node.js)       │
                             │  - TCP: 7611     │
                             │  - UDP: 6611     │
                             │  - API: 3000     │
                             └────────┬─────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
              │    HLS    │    │ WebSocket │    │    SSE    │
              │  Streams  │    │  Frames   │    │  Frames   │
              └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
                    │                 │                 │
              ┌─────▼──────────────────▼─────────────────▼─────┐
              │           Next.js Application                   │
              │  - Video Player Components                      │
              │  - Real-time Frame Display                      │
              │  - Vehicle Management                           │
              └─────────────────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Base URL
```
http://164.90.182.2:3000
```

### 1. Get Connected Vehicles
```http
GET /api/vehicles/connected
```

**Response:**
```json
[
  {
    "id": "221083666502",
    "phone": "221083666502",
    "channels": [
      { "physicalChannel": 1, "logicalChannel": 1, "type": "video" },
      { "physicalChannel": 2, "logicalChannel": 2, "type": "video" }
    ],
    "activeStreams": [1, 2]
  }
]
```

### 2. Start Video Stream
```http
POST /api/vehicles/:vehicleId/start-live
Content-Type: application/json

{
  "channel": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video stream started for vehicle 221083666502, channel 1"
}
```

### 3. Stop Video Stream
```http
POST /api/vehicles/:vehicleId/stop-live
Content-Type: application/json

{
  "channel": 1
}
```

### 4. Get Stream Info
```http
GET /api/vehicles/:vehicleId/stream-info?channel=1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicle": {
      "id": "221083666502",
      "connected": true,
      "lastHeartbeat": "2024-01-15T10:30:00.000Z"
    },
    "stream": {
      "vehicleId": "221083666502",
      "channel": 1,
      "active": true,
      "frameCount": 1250,
      "lastFrame": "2024-01-15T10:30:05.000Z"
    }
  }
}
```

### 5. HLS Playlist (for video playback)
```http
GET /hls/:vehicleId/channel_:channel/playlist.m3u8
```

### 6. WebSocket Connection
```
ws://164.90.182.2:3000/ws/video
```

### 7. SSE Connection
```http
GET /api/stream/sse
```

---

## 🚀 Next.js Implementation

### 1. Install Dependencies

```bash
npm install hls.js
npm install @types/hls.js --save-dev
```

### 2. Create API Service

**`lib/videoApi.ts`**
```typescript
const API_BASE = 'http://164.90.182.2:3000';

export interface Vehicle {
  id: string;
  phone: string;
  channels: Channel[];
  activeStreams: number[];
}

export interface Channel {
  physicalChannel: number;
  logicalChannel: number;
  type: string;
}

export const videoApi = {
  // Get all connected vehicles
  async getVehicles(): Promise<Vehicle[]> {
    const res = await fetch(`${API_BASE}/api/vehicles/connected`);
    return res.json();
  },

  // Start video stream
  async startStream(vehicleId: string, channel: number) {
    const res = await fetch(`${API_BASE}/api/vehicles/${vehicleId}/start-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel })
    });
    return res.json();
  },

  // Stop video stream
  async stopStream(vehicleId: string, channel: number) {
    const res = await fetch(`${API_BASE}/api/vehicles/${vehicleId}/stop-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel })
    });
    return res.json();
  },

  // Get HLS playlist URL
  getHlsUrl(vehicleId: string, channel: number): string {
    return `${API_BASE}/hls/${vehicleId}/channel_${channel}/playlist.m3u8`;
  },

  // Get WebSocket URL
  getWebSocketUrl(): string {
    return `ws://164.90.182.2:3000/ws/video`;
  },

  // Get SSE URL
  getSseUrl(): string {
    return `${API_BASE}/api/stream/sse`;
  }
};
```

---

## 🎥 Video Player Component

### Option 1: HLS Player (Recommended)

**`components/HlsVideoPlayer.tsx`**
```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps {
  vehicleId: string;
  channel: number;
  autoplay?: boolean;
}

export default function HlsVideoPlayer({ 
  vehicleId, 
  channel, 
  autoplay = true 
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hlsUrl = `http://164.90.182.2:3000/hls/${vehicleId}/channel_${channel}/playlist.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('playing');
        if (autoplay) {
          video.play().catch(e => {
            console.log('Autoplay blocked:', e);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setStatus('error');
          setError(data.type);
          
          // Retry after 5 seconds
          setTimeout(() => {
            setStatus('loading');
            hls.loadSource(hlsUrl);
          }, 5000);
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
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
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-auto"
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
      
      <div className="absolute top-2 left-2 bg-black/70 text-white px-3 py-1 rounded text-sm">
        {vehicleId} - Ch{channel}
      </div>
      
      {status === 'playing' && (
        <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded text-sm">
          ● LIVE
        </div>
      )}
    </div>
  );
}
```

### Option 2: WebSocket Frame Display

**`components/WebSocketVideoPlayer.tsx`**
```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

interface WebSocketVideoPlayerProps {
  vehicleId: string;
  channel: number;
}

export default function WebSocketVideoPlayer({ 
  vehicleId, 
  channel 
}: WebSocketVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [stats, setStats] = useState({ frames: 0, iframes: 0, fps: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://164.90.182.2:3000/ws/video');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Subscribe to specific vehicle/channel
      ws.send(JSON.stringify({
        type: 'subscribe',
        vehicleId,
        channel
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'frame') {
          // Update stats
          setStats(prev => ({
            frames: prev.frames + 1,
            iframes: data.isIFrame ? prev.iframes + 1 : prev.iframes,
            fps: calculateFps(prev.frames)
          }));
          
          // Render frame indicator on canvas
          renderFrame(data.isIFrame);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        // Re-initialize connection
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [vehicleId, channel]);

  const renderFrame = (isIFrame: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw frame indicator
    ctx.fillStyle = isIFrame ? '#4ec9b0' : '#888';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      isIFrame ? '🎬 I-FRAME' : '📹 P-FRAME',
      canvas.width / 2,
      canvas.height / 2
    );
  };

  const calculateFps = (frames: number): number => {
    // Implement FPS calculation logic
    return 0;
  };

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-auto"
      />
      
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3">
        <div className="flex justify-between text-sm">
          <span>Frames: {stats.frames}</span>
          <span>I-Frames: {stats.iframes}</span>
          <span>FPS: {stats.fps}</span>
          <span className={connected ? 'text-green-500' : 'text-red-500'}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

## 📺 Complete Page Example

**`app/video/page.tsx`**
```typescript
'use client';

import { useEffect, useState } from 'react';
import HlsVideoPlayer from '@/components/HlsVideoPlayer';
import { videoApi, Vehicle } from '@/lib/videoApi';

export default function VideoPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicles();
    const interval = setInterval(loadVehicles, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await videoApi.getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error('Failed to load vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const startStream = async (vehicleId: string, channel: number) => {
    try {
      await videoApi.startStream(vehicleId, channel);
      console.log(`Started stream: ${vehicleId} Ch${channel}`);
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading vehicles...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Live Video Streams</h1>
      
      <div className="mb-4 text-gray-600">
        {vehicles.length} vehicles connected
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(vehicle => (
          vehicle.channels.map(channel => (
            <div key={`${vehicle.id}_${channel.logicalChannel}`} className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  {vehicle.id} - Channel {channel.logicalChannel}
                </h3>
                <button
                  onClick={() => startStream(vehicle.id, channel.logicalChannel)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                >
                  Start
                </button>
              </div>
              
              <HlsVideoPlayer
                vehicleId={vehicle.id}
                channel={channel.logicalChannel}
                autoplay={true}
              />
            </div>
          ))
        ))}
      </div>

      {vehicles.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No vehicles connected. Waiting for cameras...
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 SSE Integration (Alternative)

**`components/SseVideoPlayer.tsx`**
```typescript
'use client';

import { useEffect, useState } from 'react';

export default function SseVideoPlayer() {
  const [frames, setFrames] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('http://164.90.182.2:3000/api/stream/sse');

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'frame') {
          setFrames(prev => [...prev.slice(-29), data]); // Keep last 30 frames
        }
      } catch (error) {
        console.error('SSE parse error:', error);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      
      // Reconnect after 3 seconds
      setTimeout(() => {
        // Re-initialize
      }, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="p-4">
      <div className={`mb-4 ${connected ? 'text-green-500' : 'text-red-500'}`}>
        {connected ? '● Connected' : '○ Disconnected'}
      </div>
      
      <div className="space-y-2">
        {frames.map((frame, i) => (
          <div key={i} className="p-2 bg-gray-100 rounded">
            {frame.vehicleId} - Ch{frame.channel} - 
            {frame.isIFrame ? ' I-Frame' : ' P-Frame'} - 
            {frame.size} bytes
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🚀 Production Deployment

### 1. Environment Variables

**`.env.local`**
```bash
NEXT_PUBLIC_VIDEO_API_URL=http://164.90.182.2:3000
NEXT_PUBLIC_WS_URL=ws://164.90.182.2:3000
```

### 2. Update API Service

```typescript
const API_BASE = process.env.NEXT_PUBLIC_VIDEO_API_URL || 'http://localhost:3000';
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';
```

### 3. CORS Configuration (Video Server)

Add to your video server:

```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://your-nextjs-app.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```

### 4. Nginx Proxy (Optional)

```nginx
location /video-api/ {
  proxy_pass http://164.90.182.2:3000/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

---

## 📊 API Response Types

**`types/video.ts`**
```typescript
export interface Vehicle {
  id: string;
  phone: string;
  channels: Channel[];
  activeStreams: number[];
}

export interface Channel {
  physicalChannel: number;
  logicalChannel: number;
  type: 'video' | 'audio' | 'audio_video';
  hasGimbal?: boolean;
}

export interface StreamInfo {
  vehicleId: string;
  channel: number;
  active: boolean;
  frameCount: number;
  lastFrame: string | null;
}

export interface FrameData {
  type: 'frame';
  vehicleId: string;
  channel: number;
  data: string; // base64
  size: number;
  isIFrame: boolean;
  timestamp: number;
}
```

---

## ✅ Quick Start Checklist

- [ ] Install `hls.js` in Next.js project
- [ ] Create `lib/videoApi.ts` with API functions
- [ ] Create `HlsVideoPlayer` component
- [ ] Create video page with vehicle grid
- [ ] Test with connected cameras
- [ ] Configure CORS on video server
- [ ] Set up environment variables
- [ ] Deploy to production

---

## 🔧 Troubleshooting

### HLS Stream Not Loading

1. Check if FFmpeg is installed on video server
2. Verify HLS directory exists: `/hls/{vehicleId}/channel_{N}/`
3. Check playlist file: `playlist.m3u8`
4. Verify CORS headers

### WebSocket Connection Failed

1. Check WebSocket URL (ws:// not wss://)
2. Verify port 3000 is accessible
3. Check firewall rules
4. Test with browser console

### No Vehicles Showing

1. Verify cameras are connected to video server
2. Check API endpoint: `/api/vehicles/connected`
3. Verify server is running on port 3000

---

## 📚 Additional Resources

- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [Next.js Documentation](https://nextjs.org/docs)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

**Last Updated:** 2024
**Video Server Version:** 1.0.0
**Compatible with:** Next.js 13+, React 18+
