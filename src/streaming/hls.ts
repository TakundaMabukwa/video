import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

export class HLSStreamer {
  private hlsDir = path.join(process.cwd(), 'hls');

  constructor() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  startHLSStream(vehicleId: string, channel: number, h264FilePath: string): void {
    const outputDir = path.join(this.hlsDir, vehicleId, `channel_${channel}`);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const playlistPath = path.join(outputDir, 'playlist.m3u8');

    ffmpeg(h264FilePath)
      .outputOptions([
        '-c:v copy',
        '-f hls',
        '-hls_time 2',
        '-hls_list_size 5',
        '-hls_flags delete_segments+append_list'
      ])
      .output(playlistPath)
      .on('start', () => {
        console.log(`HLS stream started for ${vehicleId} channel ${channel}`);
      })
      .on('error', (err) => {
        console.error(`HLS error: ${err.message}`);
      })
      .run();
  }

  getPlaylistPath(vehicleId: string, channel: number): string {
    return `/hls/${vehicleId}/channel_${channel}/playlist.m3u8`;
  }
}