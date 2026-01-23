# Deploy Server Changes via Git

## Your server already has CORS configured!
The code in `src/index.ts` already includes:
```typescript
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://46.101.219.78:3000/'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
```

## Steps to Deploy:

### 1. Commit and Push Changes
```bash
cd c:/Users/mabuk/Desktop/servers/video

git add .
git commit -m "Add CORS and HLS streaming improvements"
git push origin main
```

### 2. Server Will Auto-Deploy
Your server should have a git hook or PM2 watch that auto-deploys on push.

If not, you need to manually pull on the server (requires SSH access).

## Alternative: Use DigitalOcean API

If you have a DigitalOcean API token, you can run commands via their API:

```bash
# Install doctl (DigitalOcean CLI)
# Windows: Download from https://github.com/digitalocean/doctl/releases

# Authenticate
doctl auth init

# Run commands on droplet
doctl compute ssh <droplet-id> --ssh-command "cd /root/video && git pull && npm install && npm run build && pm2 restart video-server"
```

## What's Already Done:

✅ CORS configured in code
✅ HLS streaming setup
✅ Logging added to FFmpeg

## What's Needed on Server:

1. Install FFmpeg: `apt install ffmpeg -y`
2. Install cors package: `npm install cors`
3. Rebuild: `npm run build`
4. Restart: `pm2 restart video-server`

## Test Without SSH:

Check if API is accessible:
```bash
curl http://164.90.182.2:3000/health
curl http://164.90.182.2:3000/api/vehicles
```

If these work, your Next.js frontend can connect!

## Next.js Frontend Setup:

Your Next.js app just needs to:
1. Install hls.js: `npm install hls.js`
2. Add the API proxy routes (from SETUP_STREAMING.md)
3. Add the HLSPlayer component
4. Point to: `http://164.90.182.2:3000`

The server is ready - you just need to deploy the code changes!
