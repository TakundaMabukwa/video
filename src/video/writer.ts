import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { VideoStorage } from '../storage/videoStorage';

export class VideoWriter {
  private fileStreams = new Map<string, fs.WriteStream>();
  private frameCounters = new Map<string, number>();
  private videoStorage = new VideoStorage();
  private videoIds = new Map<string, string>();
  private startTimes = new Map<string, Date>();
  private filePaths = new Map<string, string>();
  private readonly segmentDurationMs = Math.max(10_000, Number(process.env.LIVE_SEGMENT_SECONDS || 60) * 1000);
  private pendingTranscodes = new Set<string>();

  private getFfmpegBinary(): string {
    if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const installer = require('@ffmpeg-installer/ffmpeg');
      if (installer?.path) return installer.path;
    } catch {}
    return 'ffmpeg';
  }

  private kickoffPlayableTranscode(sourcePath: string): void {
    if (!sourcePath || /\.mp4$/i.test(sourcePath)) return;
    if (!fs.existsSync(sourcePath)) return;

    const parsed = path.parse(sourcePath);
    const outputPath = path.join(parsed.dir, `${parsed.name}.playable.mp4`);

    try {
      if (fs.existsSync(outputPath)) {
        const outStat = fs.statSync(outputPath);
        const inStat = fs.statSync(sourcePath);
        if (outStat.size > 0 && outStat.mtimeMs >= inStat.mtimeMs) return;
      }
    } catch {}

    if (this.pendingTranscodes.has(outputPath)) return;
    this.pendingTranscodes.add(outputPath);

    const ffmpeg = this.getFfmpegBinary();
    const tryRun = (args: string[]) => new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += String(d || ''); });
      proc.on('error', (err) => reject(new Error(err?.message || 'ffmpeg spawn failed')));
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve();
          return;
        }
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
        reject(new Error(stderr.slice(0, 800) || `ffmpeg exited ${code}`));
      });
    });

    (async () => {
      const commonOut = ['-movflags', '+faststart', outputPath];
      try {
        await tryRun([
          '-hide_banner', '-loglevel', 'error', '-y',
          '-fflags', '+genpts', '-r', '25', '-f', 'h264', '-i', sourcePath,
          '-c:v', 'copy',
          ...commonOut
        ]);
      } catch {
        await tryRun([
          '-hide_banner', '-loglevel', 'error', '-y',
          '-fflags', '+genpts', '-r', '25', '-f', 'h264', '-i', sourcePath,
          '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
          ...commonOut
        ]);
      }
    })()
      .catch((err) => {
        console.error(`Failed to transcode ${sourcePath}:`, err?.message || err);
      })
      .finally(() => {
        this.pendingTranscodes.delete(outputPath);
      });
  }

  writeFrame(vehicleId: string, channel: number, frameData: Buffer): void {
    const streamKey = `${vehicleId}_${channel}`;
    
    if (!this.fileStreams.has(streamKey)) {
      this.createOutputStream(vehicleId, channel, streamKey);
    } else {
      const startTime = this.startTimes.get(streamKey);
      if (startTime && Date.now() - startTime.getTime() >= this.segmentDurationMs) {
        this.rotateSegment(vehicleId, channel, streamKey);
      }
    }

    const stream = this.fileStreams.get(streamKey);
    if (stream) {
      stream.write(frameData);
      
      const frameCount = (this.frameCounters.get(streamKey) || 0) + 1;
      this.frameCounters.set(streamKey, frameCount);
      
      if (frameCount === 1) {
        console.log(`First frame written: vehicle ${vehicleId}, channel ${channel}`);
      }
      
      if (frameCount % 100 === 0) {
        console.log(`Frames written: vehicle ${vehicleId}, channel ${channel}, count ${frameCount}`);
      }
    }
  }

  private async createOutputStream(vehicleId: string, channel: number, streamKey: string): Promise<void> {
    const recordingsDir = path.join(process.cwd(), 'recordings', vehicleId);
    
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    const startedAt = new Date();
    const timestamp = startedAt.toISOString().replace(/[:.]/g, '-');
    const filename = `channel_${channel}_${timestamp}.h264`;
    const filepath = path.join(recordingsDir, filename);
    
    const stream = fs.createWriteStream(filepath);
    this.fileStreams.set(streamKey, stream);
    this.startTimes.set(streamKey, startedAt);
    this.filePaths.set(streamKey, filepath);
    
    stream.on('error', (error) => {
      console.error(`Error writing video file ${filepath}:`, error);
      this.fileStreams.delete(streamKey);
    });

    console.log(`Video recording started: ${filepath}`);
    
    // Save to database
    try {
      const videoId = await this.videoStorage.saveVideo(
        vehicleId,
        channel,
        filepath,
        startedAt,
        'live'
      );
      this.videoIds.set(streamKey, videoId);
    } catch (error) {
      console.error('Failed to save video metadata to database:', error);
    }
  }

  private finalizeSegment(streamKey: string, vehicleId: string, channel: number): void {
    const stream = this.fileStreams.get(streamKey);
    
    if (stream) {
      const videoId = this.videoIds.get(streamKey);
      const startTime = this.startTimes.get(streamKey);
      const filepath = this.filePaths.get(streamKey);
      stream.end(() => {
        if (videoId && startTime && filepath) {
          const endTime = new Date();
          const duration = Math.max(1, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
          try {
            const stats = fs.statSync(filepath);
            this.videoStorage.updateVideoEnd(videoId, endTime, stats.size, duration).catch(console.error);
            this.kickoffPlayableTranscode(filepath);
          } catch (error) {
            console.error('Failed to update video metadata:', error);
          }
        }
      });
      this.fileStreams.delete(streamKey);
      
      const frameCount = this.frameCounters.get(streamKey) || 0;
      console.log(`Video recording stopped: vehicle ${vehicleId}, channel ${channel}, total frames ${frameCount}`);
      this.frameCounters.delete(streamKey);
      this.videoIds.delete(streamKey);
      this.startTimes.delete(streamKey);
      this.filePaths.delete(streamKey);
    }
  }

  private rotateSegment(vehicleId: string, channel: number, streamKey: string): void {
    this.finalizeSegment(streamKey, vehicleId, channel);
    this.createOutputStream(vehicleId, channel, streamKey);
  }

  stopRecording(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    this.finalizeSegment(streamKey, vehicleId, channel);
  }

  stopAllRecordings(): void {
    for (const [streamKey] of this.fileStreams.entries()) {
      const [vehicleId, channelStr] = streamKey.split('_');
      this.finalizeSegment(streamKey, vehicleId, Number(channelStr || 1));
      console.log(`Stopped recording: ${streamKey}`);
    }
    this.fileStreams.clear();
    this.frameCounters.clear();
    this.filePaths.clear();
  }

  getRecordingStats(): { activeRecordings: number; totalFrames: number } {
    const totalFrames = Array.from(this.frameCounters.values()).reduce((sum, count) => sum + count, 0);
    return {
      activeRecordings: this.fileStreams.size,
      totalFrames
    };
  }
}
