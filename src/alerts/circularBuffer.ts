import * as fs from 'fs';
import * as path from 'path';

interface FrameData {
  data: Buffer;
  timestamp: Date;
  isIFrame: boolean;
}

export class CircularVideoBuffer {
  private frames: FrameData[] = [];
  private maxDuration: number; // seconds
  private vehicleId: string;
  private channel: number;
  private isRecordingPostEvent = false;
  private postEventFrames: FrameData[] = [];
  private postEventStartTime: Date | null = null;

  constructor(vehicleId: string, channel: number, maxDuration: number = 30) {
    this.vehicleId = vehicleId;
    this.channel = channel;
    this.maxDuration = maxDuration;
  }

  addFrame(frameData: Buffer, timestamp: Date, isIFrame: boolean = false): void {
    this.frames.push({ data: frameData, timestamp, isIFrame });

    // Remove frames older than maxDuration
    const cutoffTime = new Date(timestamp.getTime() - this.maxDuration * 1000);
    this.frames = this.frames.filter(f => f.timestamp >= cutoffTime);

    // If recording post-event, collect frames
    if (this.isRecordingPostEvent) {
      this.postEventFrames.push({ data: frameData, timestamp, isIFrame });
      
      const elapsed = (timestamp.getTime() - this.postEventStartTime!.getTime()) / 1000;
      if (elapsed >= this.maxDuration) {
        this.finalizePostEventRecording();
      }
    }
  }

  async captureEventClip(alertId: string, preEventDuration: number = 30): Promise<string> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - preEventDuration * 1000);
    const preEventFrames = this.frames.filter(f => f.timestamp >= cutoffTime);

    // Start post-event recording
    this.isRecordingPostEvent = true;
    this.postEventStartTime = now;
    this.postEventFrames = [];

    // Save pre-event frames immediately
    const clipPath = await this.saveClip(alertId, preEventFrames, 'pre');
    console.log(`📹 Pre-event clip saved: ${clipPath} (${preEventFrames.length} frames)`);

    return clipPath;
  }

  private async finalizePostEventRecording(): Promise<void> {
    if (this.postEventFrames.length === 0) return;

    const alertId = `post_${Date.now()}`;
    const clipPath = await this.saveClip(alertId, this.postEventFrames, 'post');
    console.log(`📹 Post-event clip saved: ${clipPath} (${this.postEventFrames.length} frames)`);

    this.isRecordingPostEvent = false;
    this.postEventFrames = [];
    this.postEventStartTime = null;
  }

  private async saveClip(alertId: string, frames: FrameData[], type: 'pre' | 'post'): Promise<string> {
    const alertDir = path.join(process.cwd(), 'recordings', this.vehicleId, 'alerts');
    if (!fs.existsSync(alertDir)) {
      fs.mkdirSync(alertDir, { recursive: true });
    }

    const filename = `${alertId}_ch${this.channel}_${type}_${Date.now()}.h264`;
    const filepath = path.join(alertDir, filename);
    
    const stream = fs.createWriteStream(filepath);
    for (const frame of frames) {
      stream.write(frame.data);
    }
    stream.end();

    return filepath;
  }

  getFrames(durationSeconds: number): FrameData[] {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - durationSeconds * 1000);
    return this.frames.filter(f => f.timestamp >= cutoffTime);
  }

  getStats() {
    return {
      totalFrames: this.frames.length,
      oldestFrame: this.frames[0]?.timestamp,
      newestFrame: this.frames[this.frames.length - 1]?.timestamp,
      isRecordingPostEvent: this.isRecordingPostEvent
    };
  }
}
