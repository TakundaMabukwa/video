import * as dgram from 'dgram';
import { JTT1078RTPParser } from './rtpParser';
import { FrameAssembler } from './frameAssembler';
import { VideoWriter } from '../video/writer';
import { StreamInfo } from '../types/jtt';

export class UDPRTPServer {
  private server: dgram.Socket;
  private frameAssembler = new FrameAssembler();
  private videoWriter = new VideoWriter();
  private streams = new Map<string, StreamInfo>();

  constructor(private port: number) {
    this.server = dgram.createSocket('udp4');
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.bind(this.port, () => {
        console.log(`UDP RTP server listening on port ${this.port}`);
        resolve();
      });

      this.server.on('message', (msg, rinfo) => {
        this.handleRTPPacket(msg, rinfo);
      });

      this.server.on('error', (error) => {
        console.error('UDP server error:', error);
      });
    });
  }

  private handleRTPPacket(buffer: Buffer, rinfo: dgram.RemoteInfo): void {
    const parsed = JTT1078RTPParser.parseRTPPacket(buffer);
    if (!parsed) {
      return;
    }

    const { header, payload } = parsed;
    const streamKey = `${rinfo.address}_${header.channelNumber}`;
    
    // Update stream info
    let streamInfo = this.streams.get(streamKey);
    if (!streamInfo) {
      streamInfo = {
        vehicleId: rinfo.address, // Use IP as vehicle ID for now
        channel: header.channelNumber,
        active: true,
        frameCount: 0,
        lastFrame: null
      };
      this.streams.set(streamKey, streamInfo);
      console.log(`New stream started: ${streamKey}`);
    }

    // Attempt frame assembly
    const completeFrame = this.frameAssembler.assembleFrame(header, payload);
    if (completeFrame) {
      streamInfo.frameCount++;
      streamInfo.lastFrame = new Date();
      
      // Write frame to disk
      this.videoWriter.writeFrame(streamInfo.vehicleId, header.channelNumber, completeFrame);
      
      // Log I-frame detection (basic heuristic)
      if (this.isIFrame(completeFrame)) {
        console.log(`I-frame detected: vehicle ${streamInfo.vehicleId}, channel ${header.channelNumber}, size ${completeFrame.length}`);
      }
    }
  }

  private isIFrame(frame: Buffer): boolean {
    // Basic H.264 I-frame detection (NAL unit type 5)
    // Look for 0x00 0x00 0x00 0x01 0x65 (I-frame start code)
    for (let i = 0; i < frame.length - 4; i++) {
      if (frame[i] === 0x00 && frame[i + 1] === 0x00 && 
          frame[i + 2] === 0x00 && frame[i + 3] === 0x01) {
        const nalType = frame[i + 4] & 0x1F;
        if (nalType === 5) { // IDR slice
          return true;
        }
      }
    }
    return false;
  }

  getStreamInfo(vehicleId: string, channel: number): StreamInfo | undefined {
    const streamKey = `${vehicleId}_${channel}`;
    return this.streams.get(streamKey);
  }

  getAllStreams(): StreamInfo[] {
    return Array.from(this.streams.values());
  }

  stopStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    const streamInfo = this.streams.get(streamKey);
    if (streamInfo) {
      streamInfo.active = false;
      console.log(`Stream stopped: ${streamKey}`);
    }
  }

  getStats() {
    return {
      activeStreams: Array.from(this.streams.values()).filter(s => s.active).length,
      totalStreams: this.streams.size,
      frameAssemblerStats: this.frameAssembler.getStats()
    };
  }
}