# Next.js Frontend Integration - Screenshot System

This is the complete frontend contract for integrating screenshots from this video server into a separate Next.js app.

## Scope
This doc covers only screenshot features:
- discover live vehicles/channels
- request screenshot (single and all vehicles)
- fetch screenshot gallery data
- run 30s capture cycle

## Base URL
Use one API base URL from Next.js:
- `NEXT_PUBLIC_VIDEO_API_BASE=http://164.90.182.2:3000`

All endpoints below are relative to this base.

## Required Endpoints

## 1) `GET /api/vehicles/connected`
Purpose:
- Get live vehicles and available channels.
- Build the "all vehicles / all channels" target list.

Expected response (current server shape):
```json
[
  {
    "id": "221087866173",
    "phone": "221087866173",
    "channels": [
      { "logicalChannel": 1, "type": "video" }
    ],
    "activeStreams": [1]
  }
]
```

Used in server:
- `src/index.ts` route registration
- `src/api/routes.ts`

## 2) `POST /api/vehicles/:id/screenshot`
Purpose:
- Trigger screenshot capture for one vehicle/channel.

Request body:
```json
{
  "channel": 1,
  "fallback": true,
  "fallbackDelayMs": 600
}
```

Notes:
- `fallback=true` is strongly recommended.
- Fallback captures from live HLS if terminal `0x0801` does not arrive.

Response example:
```json
{
  "success": true,
  "message": "Screenshot requested for vehicle 221087866173, channel 1",
  "fallback": { "ok": true, "imageId": "uuid-123" }
}
```

Used in server:
- API endpoint: `src/api/routes.ts`
- Terminal command send: `src/tcp/server.ts` -> `requestScreenshot(...)`
- Command builders: `src/tcp/screenshotCommands.ts`, `src/tcp/commands.ts`

## 3) `GET /api/screenshots/recent?limit=200&minutes=30`
Purpose:
- Fetch gallery data for UI.

Response example:
```json
{
  "success": true,
  "screenshots": [
    {
      "id": "uuid-123",
      "device_id": "221087866173",
      "channel": 1,
      "file_path": "221087866173/ch1/2026-02-14T23-09-08-123Z.jpg",
      "storage_url": "https://...",
      "file_size": 245678,
      "timestamp": "2026-02-14T23:09:08.000Z",
      "alert_id": null
    }
  ],
  "total": 1,
  "count": 1,
  "lastUpdate": "2026-02-14T23:09:09.000Z"
}
```

Used in server:
- `src/api/routes.ts` (`/screenshots/recent`)

## Optional Endpoints (Useful)

## 4) `GET /health`
Purpose:
- Basic API liveness check.

## 5) `GET /api/vehicles/:id/stream-info?channel=1`
Purpose:
- Confirm stream is active before requesting screenshots.

## 6) `GET /api/alerts/:id/signals`
Purpose:
- Get normalized and complete signal breakdown for one alert.
- Use this endpoint when frontend needs exact alert semantics, not only the primary label.

Response example:
```json
{
  "success": true,
  "data": {
    "id": "ALT-1769000000000-1",
    "timestamp": "2026-02-14T23:20:00.000Z",
    "priority": "high",
    "primaryAlertType": "Driver Fatigue",
    "alertSignals": [
      "jt808_fatigue",
      "jtt1078_behavior_fatigue",
      "jtt1078_abnormal_driving"
    ],
    "alarmFlags": {
      "fatigue": true
    },
    "alarmFlagSetBits": [2],
    "videoAlarms": {
      "abnormalDriving": true,
      "setBits": [5]
    },
    "drivingBehavior": {
      "fatigue": true,
      "fatigueLevel": 86
    },
    "rawAlarmFlag": 4,
    "rawStatusFlag": 0
  }
}
```

## Screenshot Source Logic (Server)

## Primary source: terminal upload
- Server sends `0x9201` single-frame request.
- Terminal may return multimedia `0x0801` JPEG.
- Server parses/stores image.

Relevant files:
- `src/tcp/server.ts` (`requestScreenshot`, `case 0x0801`, `handleMultimediaData`)
- `src/tcp/multimediaParser.ts`

## Fallback source: HLS frame capture
- API endpoint waits `fallbackDelayMs`.
- Server runs ffmpeg on `hls/{vehicleId}/channel_{channel}/playlist.m3u8`.
- One JPEG frame captured and stored.

Relevant file:
- `src/api/routes.ts` (`captureScreenshotFromHLS`)

## Image Storage Details

Images are stored in:
1. Supabase Storage (public URL)
2. `images` database table metadata

Storage code:
- `src/storage/imageStorage.ts`
- `src/storage/supabase.ts`

Important:
- Frontend should render only rows where `storage_url` is a valid URL.
- Rows with `storage_url = "upload-failed"` or `"local-only"` should be flagged as unavailable.

## Frontend Polling/Capture Strategy

Recommended timings:
1. Every 30s: request screenshots for all live vehicle/channels.
2. Every 5-10s: refresh gallery from `/api/screenshots/recent`.
3. When rendering alert details pages, fetch `/api/alerts/:id/signals` to show exact trigger signals.

## All-vehicles capture algorithm
1. Call `GET /api/vehicles/connected`.
2. For each vehicle:
- use video channels from `channels[]` (types `video` or `audio_video`)
- fallback to channel `1` if channel list is empty
3. Fan out `POST /api/vehicles/:id/screenshot` in parallel.
4. Refresh gallery.

## Next.js Reference Implementation

## `lib/screenshot-api.ts`
```ts
const API = process.env.NEXT_PUBLIC_VIDEO_API_BASE!;

export type ConnectedVehicle = {
  id: string;
  channels?: Array<{ logicalChannel: number; type: string }>;
};

export async function getConnectedVehicles(): Promise<ConnectedVehicle[]> {
  const r = await fetch(`${API}/api/vehicles/connected`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`vehicles/connected ${r.status}`);
  return r.json();
}

export async function requestScreenshot(vehicleId: string, channel: number) {
  const r = await fetch(`${API}/api/vehicles/${encodeURIComponent(vehicleId)}/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, fallback: true, fallbackDelayMs: 600 })
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.success) throw new Error(body.message || `screenshot ${r.status}`);
  return body;
}

export async function getRecentScreenshots(limit = 200, minutes = 30) {
  const r = await fetch(`${API}/api/screenshots/recent?limit=${limit}&minutes=${minutes}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`screenshots/recent ${r.status}`);
  const body = await r.json();
  return body.screenshots ?? [];
}
```

## `hooks/useScreenshotCycle.ts`
```ts
import { useEffect, useRef } from 'react';
import { getConnectedVehicles, requestScreenshot } from '@/lib/screenshot-api';

export function useScreenshotCycle(enabled = true, intervalMs = 30000) {
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const run = async () => {
      const vehicles = await getConnectedVehicles();
      const jobs: Array<Promise<any>> = [];

      for (const v of vehicles) {
        const channels = (v.channels ?? [])
          .filter((c) => c.type === 'video' || c.type === 'audio_video')
          .map((c) => c.logicalChannel);

        const targetChannels = channels.length ? [...new Set(channels)] : [1];
        for (const ch of targetChannels) jobs.push(requestScreenshot(v.id, ch));
      }

      await Promise.allSettled(jobs);
    };

    run().catch(() => {});
    timer.current = setInterval(() => run().catch(() => {}), intervalMs);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled, intervalMs]);
}
```

## Backend Requirements for Separate Frontend

## 1) CORS allowlist
In `src/index.ts`, add your Next.js origin to CORS `origin` list.

## 2) Public reachability
Expose this server to the Next.js runtime and browser users.

## 3) Env for storage
Ensure Supabase env vars are set on this server:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) ffmpeg installed
Fallback capture requires ffmpeg available on server PATH.

## 5) Database table
`images` table must be present and writable.

## Quick Frontend Checklist
1. Set `NEXT_PUBLIC_VIDEO_API_BASE`.
2. Implement the 3 required endpoint calls.
3. Run 30s capture cycle for all live vehicle/channels.
4. Poll gallery every 5-10s.
5. Render only valid `storage_url` values.
6. Add UI status for per-request failures and fallback result.

## Troubleshooting

If requests succeed but no images appear:
1. Check `POST /api/vehicles/:id/screenshot` response `fallback.ok`.
2. Check `GET /api/screenshots/recent` returns `screenshots` entries.
3. If entries exist but image broken, inspect `storage_url` value.
4. Verify Supabase bucket/public access and server env.

If no connected vehicles:
1. Confirm live stream is active first.
2. Verify `/api/vehicles/connected` output.

If alert label seems too generic:
1. Call `/api/alerts/:id/signals`.
2. Inspect `alertSignals` and `alarmFlagSetBits` for full context.
3. Use `primaryAlertType` for headline and `alertSignals` for technical detail.

---

Reference implementation page in this repo:
- `public/screenshot-tester.html`
