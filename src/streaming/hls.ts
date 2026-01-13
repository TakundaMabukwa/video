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
    if (this.ffmpegProcesses.has(streamKey)) return;

    const outputDir = path.join(this.hlsDir, vehicleId, `channel_${channel}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    const inputPipe = path.join(process.cwd(), 'recordings', vehicleId, `channel_${channel}_live.h264`);

    const ffmpeg = spawn('ffmpeg', [
      '-re',
      '-i', 'pipe:0',
      '-c:v', 'copy',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '5',
      '-hls_flags', 'delete_segments',
      playlistPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      // Suppress verbose FFmpeg logs
    });

    ffmpeg.on('close', () => {
      this.ffmpegProcesses.delete(streamKey);
    });

    this.ffmpegProcesses.set(streamKey, ffmpeg);
  }

  writeFrame(vehicleId: string, channel: number, frame: Buffer): void {
    const streamKey = `${vehicleId}_${channel}`;
    const ffmpeg = this.ffmpegProcesses.get(streamKey);
    if (ffmpeg?.stdin?.writable) {
      ffmpeg.stdin.write(frame);
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