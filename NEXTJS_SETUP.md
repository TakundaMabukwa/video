# Next.js Video Player Setup

## 1. Install HLS.js in your Next.js app:
```bash
npm install hls.js
```

## 2. Create Video Player Component:

```tsx
// components/LiveVideoPlayer.tsx
'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function LiveVideoPlayer({ 
  vehicleId, 
  channel = 1 
}: { 
  vehicleId: string; 
  channel?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = `http://your-server:3000/api/stream/${vehicleId}/${channel}/playlist.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play();
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play();
      });
    }
  }, [vehicleId, channel]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full h-auto"
      style={{ maxWidth: '800px' }}
    />
  );
}
```

## 3. Use in your Next.js page:

```tsx
// app/vehicles/[id]/page.tsx
import LiveVideoPlayer from '@/components/LiveVideoPlayer';

export default function VehiclePage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Vehicle {params.id} Live Feed</h1>
      <LiveVideoPlayer vehicleId={params.id} channel={1} />
    </div>
  );
}
```

## 4. Start video stream from backend:
```bash
curl -X POST http://your-server:3000/api/vehicles/221080361990/start-live
```

Video will automatically appear in your Next.js app!
