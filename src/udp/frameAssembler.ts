import { JTT1078RTPHeader, JTT1078SubpackageFlag } from '../types/jtt';

interface FrameBuffer {
  timestamp: string;
  channelNumber: number;
  parts: Buffer[];
  expectedSequence: number;
  startTime: number;
  dataType: number;
}

export class FrameAssembler {
  private frameBuffers = new Map<string, FrameBuffer>();
  private readonly FRAME_TIMEOUT = 5000;
  private readonly MAX_BUFFERS = 500;
  private lastCleanup = Date.now();
  private spsCache = new Map<string, Buffer>();
  private ppsCache = new Map<string, Buffer>();

  assembleFrame(header: JTT1078RTPHeader, payload: Buffer, dataType: number): Buffer | null {
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
    
    const key = `${header.simCard}_${header.channelNumber}_${header.timestamp?.toString() || Date.now()}`;

    // Extract and cache SPS/PPS for proper H.264 decoding
    this.extractParameterSets(payload, `${header.simCard}_${header.channelNumber}`);

    if (header.subpackageFlag === JTT1078SubpackageFlag.ATOMIC) {
      return this.prependParameterSets(payload, `${header.simCard}_${header.channelNumber}`);
    }

    if (header.subpackageFlag === JTT1078SubpackageFlag.FIRST) {
      this.frameBuffers.set(key, {
        timestamp: header.timestamp?.toString() || Date.now().toString(),
        channelNumber: header.channelNumber,
        parts: [payload],
        expectedSequence: header.sequenceNumber + 1,
        startTime: Date.now(),
        dataType
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
      return this.prependParameterSets(completeFrame, `${header.simCard}_${header.channelNumber}`);
    }

    return null;
  }

  private extractParameterSets(payload: Buffer, streamKey: string): void {
    for (let i = 0; i < payload.length - 4; i++) {
      if (payload[i] === 0x00 && payload[i + 1] === 0x00 && 
          payload[i + 2] === 0x00 && payload[i + 3] === 0x01) {
        const nalType = payload[i + 4] & 0x1F;
        
        // Find next start code
        let nextStart = payload.length;
        for (let j = i + 4; j < payload.length - 4; j++) {
          if (payload[j] === 0x00 && payload[j + 1] === 0x00 && 
              payload[j + 2] === 0x00 && payload[j + 3] === 0x01) {
            nextStart = j;
            break;
          }
        }
        
        if (nalType === 7) { // SPS
          this.spsCache.set(streamKey, payload.slice(i, nextStart));
        } else if (nalType === 8) { // PPS
          this.ppsCache.set(streamKey, payload.slice(i, nextStart));
        }
        
        i = nextStart - 1;
      }
    }
  }

  private prependParameterSets(frame: Buffer, streamKey: string): Buffer {
    const sps = this.spsCache.get(streamKey);
    const pps = this.ppsCache.get(streamKey);
    
    // Only prepend if this is an I-frame and we have SPS/PPS
    if (sps && pps && this.isIFrame(frame)) {
      return Buffer.concat([sps, pps, frame]);
    }
    
    return frame;
  }

  private isIFrame(frame: Buffer): boolean {
    for (let i = 0; i < frame.length - 4; i++) {
      if (frame[i] === 0x00 && frame[i + 1] === 0x00 && 
          frame[i + 2] === 0x00 && frame[i + 3] === 0x01) {
        const nalType = frame[i + 4] & 0x1F;
        if (nalType === 5) return true;
      }
    }
    return false;
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