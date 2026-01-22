import * as dgram from 'dgram';
import { JTT1078RTPParser } from './rtpParser';
import { FrameAssembler } from './frameAssembler';
import { VideoWriter } from '../video/writer';
import { StreamInfo } from '../types/jtt';
import { AlertManager } from '../alerts/alertManager';
import { HLSStreamer } from '../streaming/hls';

export class UDPRTPServer {
  private server: dgram.Socket;
  private frameAssembler = new FrameAssembler();
  private videoWriter = new VideoWriter();
  private hlsStreamer = new HLSStreamer();
  private streams = new Map<string, StreamInfo>();
  private packetCount = 0;
  private lastLogTime = Date.now();
  private alertManager?: AlertManager;
  private onFrameCallback?: (vehicleId: string, channel: number, frame: Buffer, isIFrame: boolean) => void;

  constructor(private port: number) {
    this.server = dgram.createSocket('udp4');
  }

  setAlertManager(alertManager: AlertManager): void {
    this.alertManager = alertManager;
  }

  setFrameCallback(callback: (vehicleId: string, channel: number, frame: Buffer, isIFrame: boolean) => void): void {
    this.onFrameCallback = callback;
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
    this.packetCount++;
    
    const now = Date.now();
    if (now - this.lastLogTime > 5000) {
      console.log(`Processed ${this.packetCount} packets in last 5s`);
      this.packetCount = 0;
      this.lastLogTime = now;
    }
    
    const parsed = JTT1078RTPParser.parseRTPPacket(buffer);
    if (!parsed) {
      return;
    }

    const { header, payload, dataType } = parsed;
    
    // Use IP address as vehicle ID for UDP (no SIM in header)
    const vehicleId = rinfo.address;
    const streamKey = `${vehicleId}_${header.channelNumber}`;
    
    let streamInfo = this.streams.get(streamKey);
    if (!streamInfo) {
      streamInfo = {
        vehicleId: vehicleId,
        channel: header.channelNumber,
        active: true,
        frameCount: 0,
        lastFrame: null
      };
      this.streams.set(streamKey, streamInfo);
      console.log(`📹 New stream: ${vehicleId} ch${header.channelNumber} from ${rinfo.address}`);
      
      // Auto-start HLS stream
      this.hlsStreamer.startStream(vehicleId, header.channelNumber);
      console.log(`🎬 HLS stream started: ${streamKey}`);
    }

    const completeFrame = this.frameAssembler.assembleFrame(header, payload, dataType);
    if (completeFrame) {
      streamInfo.frameCount++;
      streamInfo.lastFrame = new Date();
      
      const isIFrame = this.isIFrame(completeFrame);
      
      if (this.alertManager) {
        this.alertManager.addFrameToBuffer(
          vehicleId,
          header.channelNumber,
          completeFrame,
          new Date(),
          isIFrame
        );
      }
      
      // Broadcast to SSE/WebSocket clients
      if (this.onFrameCallback) {
        this.onFrameCallback(vehicleId, header.channelNumber, completeFrame, isIFrame);
      }
      
      this.hlsStreamer.writeFrame(vehicleId, header.channelNumber, completeFrame);
      this.videoWriter.writeFrame(vehicleId, header.channelNumber, completeFrame);
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

  startHLSStream(vehicleId: string, channel: number): void {
    this.hlsStreamer.startStream(vehicleId, channel);
  }

  stopStream(vehicleId: string, channel: number): void {
    const streamKey = `${vehicleId}_${channel}`;
    const streamInfo = this.streams.get(streamKey);
    if (streamInfo) {
      streamInfo.active = false;
      this.hlsStreamer.stopStream(vehicleId, channel);
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