import { JTT1078RTPHeader, JTT1078SubpackageFlag } from '../types/jtt';

interface FrameBuffer {
  timestamp: number;
  channelNumber: number;
  parts: Buffer[];
  expectedSequence: number;
  startTime: number;
}

export class FrameAssembler {
  private frameBuffers = new Map<string, FrameBuffer>();
  private readonly FRAME_TIMEOUT = 5000;
  private readonly MAX_BUFFERS = 500;
  private lastCleanup = Date.now();

  assembleFrame(header: JTT1078RTPHeader, payload: Buffer): Buffer | null {
    // Periodic cleanup every 10 seconds
    if (Date.now() - this.lastCleanup > 10000) {
      this.cleanupOldFrames();
      this.lastCleanup = Date.now();
    }

    // Hard limit on buffers
    if (this.frameBuffers.size > this.MAX_BUFFERS) {
      const oldestKey = this.frameBuffers.keys().next().value;
      if (oldestKey) this.frameBuffers.delete(oldestKey);
    }
    const key = `${header.ssrc}_${header.channelNumber}_${header.timestamp}`;

    if (header.subpackageFlag === JTT1078SubpackageFlag.ATOMIC) {
      return payload;
    }

    if (header.subpackageFlag === JTT1078SubpackageFlag.FIRST) {
      this.frameBuffers.set(key, {
        timestamp: header.timestamp,
        channelNumber: header.channelNumber,
        parts: [payload],
        expectedSequence: header.sequenceNumber + 1,
        startTime: Date.now()
      });
      return null;
    }

    const frameBuffer = this.frameBuffers.get(key);
    if (!frameBuffer) return null;

    if (header.sequenceNumber !== frameBuffer.expectedSequence) {
      this.frameBuffers.delete(key);
      return null;
    }

    frameBuffer.parts.push(payload);
    frameBuffer.expectedSequence = header.sequenceNumber + 1;

    if (header.subpackageFlag === JTT1078SubpackageFlag.LAST) {
      const completeFrame = Buffer.concat(frameBuffer.parts);
      this.frameBuffers.delete(key);
      return completeFrame;
    }

    return null;
  }

  private cleanupOldFrames(): void {
    const now = Date.now();
    for (const [key, frameBuffer] of this.frameBuffers.entries()) {
      if (now - frameBuffer.startTime > this.FRAME_TIMEOUT) {
        this.frameBuffers.delete(key);
      }
    }
  }

  getStats(): { activeFrames: number; totalBuffers: number } {
    return {
      activeFrames: this.frameBuffers.size,
      totalBuffers: Array.from(this.frameBuffers.values()).reduce((sum, frame) => sum + frame.parts.length, 0)
    };
  }
}