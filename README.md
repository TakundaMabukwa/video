# JT/T 1078 Video Ingestion Server

A Node.js TypeScript server for receiving and processing JT/T 1078 video streams from AI telematics cameras.

## Features

- **JT/T 808 TCP Server** - Handles vehicle registration, authentication, and heartbeat
- **JT/T 1078 RTP Processing** - Receives and parses RTP video streams over UDP
- **Frame Reassembly** - Reconstructs split video frames using subpackage flags
- **H.264 Video Extraction** - Extracts raw video payloads and saves to disk
- **REST API** - Control video streams and monitor connected vehicles

## Quick Start

```bash
npm install
npm run dev
```

## API Endpoints

```http
GET  /api/vehicles                    # List connected vehicles
POST /api/vehicles/:id/start-live     # Start video stream
POST /api/vehicles/:id/stop-live      # Stop video stream  
GET  /api/vehicles/:id/stream-info    # Get stream metadata
GET  /api/stats                       # Server statistics
GET  /health                          # Health check
```

## Protocol Support

- **JT/T 808** (TCP:7611) - Terminal registration, heartbeat, location reporting
- **JT/T 1078** (UDP:6611) - RTP video stream reception and parsing
- **Command 0x9101** - Real-time video transmission requests

## Video Output

Extracted video frames are saved to:
```
recordings/<vehicleId>/channel_<N>_<timestamp>.h264
```

## Architecture

```
src/
├─ tcp/          # JT/T 808 TCP server & message parsing
├─ udp/          # JT/T 1078 RTP reception & frame assembly  
├─ video/        # H.264 video file writing
├─ api/          # REST endpoints
└─ types/        # Protocol definitions
```

## Testing

Connect AI cameras to:
- TCP: `localhost:7611` (JT/T 808)
- UDP: `localhost:6611` (JT/T 1078 RTP)

Use REST API on `localhost:3000` to control streams.

## Logging

The server provides detailed logging for:
- Vehicle connections/disconnections
- Video stream start/stop events
- Frame reception and I-frame detection
- Protocol parsing errors
- Frame reassembly status# video
