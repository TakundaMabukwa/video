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
  private readonly FRAME_TIMEOUT = 5000; // 5 seconds

  assembleFrame(header: JTT1078RTPHeader, payload: Buffer): Buffer | null {
    const key = `${header.ssrc}_${header.channelNumber}_${header.timestamp}`;
    
    // Clean up old incomplete frames
    this.cleanupOldFrames();

    if (header.subpackageFlag === JTT1078SubpackageFlag.ATOMIC) {
      // Complete frame in single packet
      console.log(`Complete frame received: channel ${header.channelNumber}, seq ${header.sequenceNumber}, size ${payload.length}`);
      return payload;
    }

    if (header.subpackageFlag === JTT1078SubpackageFlag.FIRST) {
      // Start new frame
      this.frameBuffers.set(key, {
        timestamp: header.timestamp,
        channelNumber: header.channelNumber,
        parts: [payload],
        expectedSequence: header.sequenceNumber + 1,
        startTime: Date.now()
      });
      
      console.log(`Frame started: channel ${header.channelNumber}, seq ${header.sequenceNumber}, timestamp ${header.timestamp}`);
      return null;
    }

    const frameBuffer = this.frameBuffers.get(key);
    if (!frameBuffer) {
      console.warn(`Received middle/last packet without first: channel ${header.channelNumber}, seq ${header.sequenceNumber}`);
      return null;
    }

    // Check sequence continuity
    if (header.sequenceNumber !== frameBuffer.expectedSequence) {
      console.warn(`Sequence gap detected: expected ${frameBuffer.expectedSequence}, got ${header.sequenceNumber}`);
      this.frameBuffers.delete(key);
      return null;
    }

    frameBuffer.parts.push(payload);
    frameBuffer.expectedSequence = header.sequenceNumber + 1;

    if (header.subpackageFlag === JTT1078SubpackageFlag.LAST) {
      // Frame complete
      const completeFrame = Buffer.concat(frameBuffer.parts);
      this.frameBuffers.delete(key);
      
      console.log(`Frame completed: channel ${header.channelNumber}, parts ${frameBuffer.parts.length}, total size ${completeFrame.length}`);
      return completeFrame;
    }

    // Middle packet, continue assembly
    return null;
  }

  private cleanupOldFrames(): void {
    const now = Date.now();
    for (const [key, frameBuffer] of this.frameBuffers.entries()) {
      if (now - frameBuffer.startTime > this.FRAME_TIMEOUT) {
        console.warn(`Frame timeout: channel ${frameBuffer.channelNumber}, timestamp ${frameBuffer.timestamp}`);
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