import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

interface FrameData {
  data: Buffer;
  timestamp: Date;
  isIFrame: boolean;
}

interface PostEventRecording {
  alertId: string;
  startTime: Date;
  frames: FrameData[];
  timer: NodeJS.Timeout;
}

export class CircularVideoBuffer extends EventEmitter {
  private frames: FrameData[] = [];
  private maxDuration: number; // seconds
  private vehicleId: string;
  private channel: number;
  private postEventRecording: PostEventRecording | null = null;

  constructor(vehicleId: string, channel: number, maxDuration: number = 30) {
    super();
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
    if (this.postEventRecording) {
      this.postEventRecording.frames.push({ data: frameData, timestamp, isIFrame });
      
      const elapsed = (timestamp.getTime() - this.postEventRecording.startTime.getTime()) / 1000;
      if (elapsed >= this.maxDuration) {
        this.finalizePostEventRecording();
      }
    }
  }

  async captureEventClip(alertId: string, preEventDuration: number = 30): Promise<string> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - preEventDuration * 1000);
    const preEventFrames = this.frames.filter(f => f.timestamp >= cutoffTime);

    // Start post-event recording with the same alertId
    // Use a timer as fallback in case frames stop arriving
    const postEventTimer = setTimeout(() => {
      this.finalizePostEventRecording();
    }, (this.maxDuration + 5) * 1000); // 30s + 5s buffer
    
    this.postEventRecording = {
      alertId,
      startTime: now,
      frames: [],
      timer: postEventTimer
    };

    // Save pre-event frames immediately
    const clipPath = await this.saveClip(alertId, preEventFrames, 'pre');
    console.log(`📹 Pre-event clip saved: ${clipPath} (${preEventFrames.length} frames, ${this.getClipDuration(preEventFrames).toFixed(1)}s)`);

    return clipPath;
  }

  private async finalizePostEventRecording(): Promise<void> {
    if (!this.postEventRecording) return;
    
    const { alertId, frames, timer } = this.postEventRecording;
    
    // Clear the fallback timer
    clearTimeout(timer);
    
    if (frames.length === 0) {
      console.log(`⚠️ No post-event frames collected for alert ${alertId}`);
      this.postEventRecording = null;
      return;
    }

    const clipPath = await this.saveClip(alertId, frames, 'post');
    const duration = this.getClipDuration(frames);
    console.log(`📹 Post-event clip saved: ${clipPath} (${frames.length} frames, ${duration.toFixed(1)}s)`);

    // Emit event so AlertManager can update the alert with post-event video path
    this.emit('post-event-complete', { alertId, clipPath, frameCount: frames.length, duration });

    this.postEventRecording = null;
  }
  
  private getClipDuration(frames: FrameData[]): number {
    if (frames.length < 2) return 0;
    const first = frames[0].timestamp.getTime();
    const last = frames[frames.length - 1].timestamp.getTime();
    return (last - first) / 1000;
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
      isRecordingPostEvent: !!this.postEventRecording,
      postEventAlertId: this.postEventRecording?.alertId,
      postEventFrameCount: this.postEventRecording?.frames.length,
      bufferDuration: this.getClipDuration(this.frames)
    };
  }
}
