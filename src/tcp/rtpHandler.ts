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

  handleRTPPacket(buffer: Buffer, vehicleId: string): void {
    const parsed = JTT1078RTPParser.parseRTPPacket(buffer);
    if (!parsed) {
      return;
    }

    const { header, payload } = parsed;
    const streamKey = `${vehicleId}_${header.channelNumber}`;
    
    // Start HLS stream on first packet
    if (!this.activeStreams.has(streamKey)) {
      this.hlsStreamer.startStream(vehicleId, header.channelNumber);
      this.activeStreams.add(streamKey);
      console.log(`🎬 HLS stream started: ${streamKey}`);
    }
    
    const completeFrame = this.frameAssembler.assembleFrame(header, payload);
    if (completeFrame) {
      this.frameCount++;
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