import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export class HLSStreamer {
  private hlsDir = path.join(process.cwd(), 'hls');
  private ffmpegProcesses = new Map<string, ChildProcess>();

  constructor() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  startStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    if (this.ffmpegProcesses.has(streamKey)) {
      console.log(`⚠️ HLS stream already running: ${streamKey}`);
      return;
    }

    const outputDir = path.join(this.hlsDir, vehicleId, `channel_${channel}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    console.log(`🎬 Starting FFmpeg HLS stream: ${streamKey}`);
    console.log(`   Output: ${playlistPath}`);

    const ffmpeg = spawn('ffmpeg', [
      '-f', 'h264',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-i', 'pipe:0',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '3',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(outputDir, 'segment%d.ts'),
      '-start_number', '0',
      '-threads', '1',
      playlistPath
    ], {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('error') || msg.includes('Error')) {
        console.error(`❌ FFmpeg error [${streamKey}]:`, msg);
      } else if (msg.includes('frame=')) {
        // Log every 100 frames
        if (Math.random() < 0.01) {
          console.log(`📊 FFmpeg [${streamKey}]:`, msg.trim().substring(0, 100));
        }
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`🛑 FFmpeg closed [${streamKey}]: code ${code}`);
      this.ffmpegProcesses.delete(streamKey);
    });

    ffmpeg.on('error', (err) => {
      console.error(`❌ FFmpeg spawn error [${streamKey}]:`, err);
    });

    ffmpeg.stdin.on('error', (err) => {
      console.error(`❌ FFmpeg stdin error [${streamKey}]:`, err.message);
    });

    this.ffmpegProcesses.set(streamKey, ffmpeg);
    console.log(`✅ FFmpeg process started: ${streamKey}`);
  }

  writeFrame(vehicleId: string, channel: number, frame: Buffer): void {
    const streamKey = `${vehicleId}_${channel}`;
    const ffmpeg = this.ffmpegProcesses.get(streamKey);
    
    if (!ffmpeg) {
      console.warn(`⚠️ No FFmpeg process for ${streamKey}`);
      return;
    }
    
    if (!ffmpeg.stdin) {
      console.warn(`⚠️ FFmpeg stdin is null for ${streamKey}`);
      return;
    }
    
    if (!ffmpeg.stdin.writable) {
      console.warn(`⚠️ FFmpeg stdin not writable for ${streamKey}`);
      return;
    }
    
    const written = ffmpeg.stdin.write(frame);
    if (!written) {
      console.warn(`⚠️ FFmpeg stdin buffer full for ${streamKey}`);
    }
  }

  stopStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    const ffmpeg = this.ffmpegProcesses.get(streamKey);
    if (ffmpeg) {
      ffmpeg.stdin?.end();
      ffmpeg.kill();
      this.ffmpegProcesses.delete(streamKey);
    }
  }

  getPlaylistPath(vehicleId: string, channel: number): string {
    return `/api/stream/${vehicleId}/${channel}/playlist.m3u8`;
  }
}