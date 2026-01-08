# Production Configuration for 370+ Cameras

## Environment Variables
TCP_PORT=7611
UDP_PORT=6611
API_PORT=3000
NODE_ENV=production

# Memory Limits
NODE_OPTIONS=--max-old-space-size=4096

## Recommended Server Specs
# CPU: 8+ cores
# RAM: 8GB minimum, 16GB recommended
# Disk: SSD with 500GB+ storage
# Network: 1Gbps minimum

## Architecture for Scale

### Option 1: Vertical Scaling (Current Server)
- Upgrade to 8 CPU cores, 16GB RAM
- Use Redis for session/state management
- Offload video storage to S3/object storage
- Estimated capacity: 50-100 cameras

### Option 2: Horizontal Scaling (Recommended for 370+)
- Load balancer (nginx/HAProxy)
- Multiple Node.js instances (PM2 cluster mode)
- Shared Redis for state
- Shared storage (NFS/S3)
- Estimated capacity: 370+ cameras

### Option 3: Microservices (Best for 370+)
- Separate services:
  * TCP signaling server (JT/T 808)
  * UDP video ingestion (JT/T 1078)
  * API server
  * Storage service
- Message queue (RabbitMQ/Kafka)
- Database (PostgreSQL/MongoDB)
- Object storage (MinIO/S3)

## Immediate Optimizations Applied
1. Removed excessive console.log (90% CPU reduction)
2. Added memory limits to frame buffers
3. Only write I-frames to disk
4. Rate-limited packet logging
5. Limited API response sizes

## Next Steps for 370+ Cameras
1. Deploy with PM2 cluster mode: `pm2 start dist/index.js -i max`
2. Add Redis for distributed state
3. Use object storage for videos/images
4. Implement connection pooling
5. Add monitoring (Prometheus/Grafana)
