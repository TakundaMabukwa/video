import * as path from 'path';
import * as fs from 'fs';

export class HLSStreamer {
  private hlsDir = path.join(process.cwd(), 'hls');

  constructor() {
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
  }

  getPlaylistPath(vehicleId: string, channel: number): string {
    return `/hls/${vehicleId}/channel_${channel}/playlist.m3u8`;
  }
}