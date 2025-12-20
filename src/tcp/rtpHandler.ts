import { JTT1078RTPParser } from '../udp/rtpParser';
import { FrameAssembler } from '../udp/frameAssembler';
import { VideoWriter } from '../video/writer';

export class TCPRTPHandler {
  private frameAssembler = new FrameAssembler();
  private videoWriter = new VideoWriter();
  private frameCount = 0;

  handleRTPPacket(buffer: Buffer, vehicleId: string): void {
    const parsed = JTT1078RTPParser.parseRTPPacket(buffer);
    if (!parsed) {
      return;
    }

    const { header, payload } = parsed;
    
    const completeFrame = this.frameAssembler.assembleFrame(header, payload);
    if (completeFrame) {
      this.frameCount++;
      this.videoWriter.writeFrame(vehicleId, header.channelNumber, completeFrame);
      
      if (this.frameCount === 1) {
        console.log(`First video frame received from ${vehicleId}, channel ${header.channelNumber}`);
      }
      
      if (this.frameCount % 100 === 0) {
        console.log(`Frames received: ${this.frameCount}`);
      }
    }
  }

  getStats() {
    return {
      frameCount: this.frameCount,
      ...this.frameAssembler.getStats()
    };
  }
}