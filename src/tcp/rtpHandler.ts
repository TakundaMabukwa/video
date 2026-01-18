import { JTT1078RTPParser } from '../udp/rtpParser';
import { FrameAssembler } from '../udp/frameAssembler';
import { VideoWriter } from '../video/writer';
import { HLSStreamer } from '../streaming/hls';

export class TCPRTPHandler {
  private frameAssembler = new FrameAssembler();
  private videoWriter = new VideoWriter();
  private hlsStreamer = new HLSStreamer();
  private frameCount = 0;
  private activeStreams = new Set<string>();
  private onFrameCallback?: (vehicleId: string, channel: number, frame: Buffer, isIFrame: boolean) => void;

  setFrameCallback(callback: (vehicleId: string, channel: number, frame: Buffer, isIFrame: boolean) => void): void {
    this.onFrameCallback = callback;
  }

  handleRTPPacket(buffer: Buffer, vehicleId: string): void {
    const parsed = JTT1078RTPParser.parseRTPPacket(buffer);
    if (!parsed) {
      return;
    }

    const { header, payload, dataType } = parsed;
    const streamKey = `${vehicleId}_${header.channelNumber}`;
    
    // Start HLS stream on first packet
    if (!this.activeStreams.has(streamKey)) {
      this.hlsStreamer.startStream(vehicleId, header.channelNumber);
      this.activeStreams.add(streamKey);
      console.log(`🎬 HLS stream started: ${streamKey}`);
    }
    
    const completeFrame = this.frameAssembler.assembleFrame(header, payload, dataType);
    if (completeFrame) {
      this.frameCount++;
      
      const isIFrame = this.isIFrame(completeFrame);
      
      // Broadcast to SSE/WebSocket
      if (this.onFrameCallback) {
        this.onFrameCallback(vehicleId, header.channelNumber, completeFrame, isIFrame);
      }
      
      this.hlsStreamer.writeFrame(vehicleId, header.channelNumber, completeFrame);
      this.videoWriter.writeFrame(vehicleId, header.channelNumber, completeFrame);
      
      if (this.frameCount === 1) {
        console.log(`First video frame received from ${vehicleId}, channel ${header.channelNumber}`);
      }
      
      if (this.frameCount % 100 === 0) {
        console.log(`Frames received: ${this.frameCount}`);
      }
    }
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

  stopStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    this.hlsStreamer.stopStream(vehicleId, channel);
    this.activeStreams.delete(streamKey);
  }

  getStats() {
    return {
      frameCount: this.frameCount,
      activeStreams: this.activeStreams.size,
      ...this.frameAssembler.getStats()
    };
  }
}