# Test Server Accessibility

## Test from your local machine:

```bash
# Test if server is responding
curl -v http://164.90.182.2:3000/health

# Test vehicles endpoint
curl http://164.90.182.2:3000/api/vehicles

# Test with timeout
curl --connect-timeout 5 http://164.90.182.2:3000/health
```

## If these work, your Next.js can connect!

The server doesn't need CORS if you:
1. Deploy Next.js on same server (164.90.182.2)
2. Or use Next.js API routes as proxy (no CORS needed)

## Quick Next.js Setup (No Server Access Needed)

Your Next.js proxy routes will handle CORS automatically!

Just add these files to your Next.js project:

### 1. `src/app/api/hls-proxy/[...path]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const url = `http://164.90.182.2:3000/api/stream/${path}`;
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const contentType = path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
    return new NextResponse(response.body, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server unreachable' }, { status: 500 });
  }
}
```

### 2. Test It

```bash
# In your Next.js project
npm install hls.js @types/hls.js

# Start dev server
npm run dev

# Test proxy
curl http://localhost:3000/api/hls-proxy/test
```

## The proxy bypasses CORS entirely!

Your Next.js server fetches from video server (server-to-server, no CORS), then serves to browser.

```
Browser → Next.js (localhost:3000) → Video Server (164.90.182.2:3000)
         ↑ No CORS issue here
```

## Try This Now:

1. Copy the Next.js code from `NEXTJS_READY.md`
2. Run `npm install hls.js`
3. Start Next.js: `npm run dev`
4. Open: `http://localhost:3000/dashboard/video`

If the video server is running (even with old code), it will work!

The server access issue doesn't block you - the proxy handles everything.
