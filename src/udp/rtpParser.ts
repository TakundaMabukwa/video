import { JTT1078RTPHeader, JTT1078SubpackageFlag } from '../types/jtt';

export class JTT1078RTPParser {
  // JT/T 1078 RTP packet structure validation
  static parseRTPPacket(buffer: Buffer): { header: JTT1078RTPHeader; payload: Buffer } | null {
    if (buffer.length < 16) {
      return null;
    }

    try {
      // Validate frame header (0x30316364)
      const frameHeader = buffer.readUInt32BE(0);
      if (frameHeader !== 0x30316364) {
        return null;
      }

      // Parse RTP header fields
      const rtpByte = buffer.readUInt8(4);
      const version = (rtpByte >> 6) & 0x03;
      const padding = ((rtpByte >> 5) & 0x01) === 1;
      const extension = ((rtpByte >> 4) & 0x01) === 1;
      const csrcCount = rtpByte & 0x0F;

      const markerAndPT = buffer.readUInt8(5);
      const marker = ((markerAndPT >> 7) & 0x01) === 1;
      const payloadType = markerAndPT & 0x7F;

      const sequenceNumber = buffer.readUInt16BE(6);
      const timestamp = buffer.readUInt32BE(8);
      const ssrc = buffer.readUInt32BE(12);

      // JT/T 1078 specific fields
      let offset = 16;
      
      // Skip CSRC list if present
      offset += csrcCount * 4;
      
      if (offset + 4 > buffer.length) {
        return null;
      }

      // Channel number and subpackage info
      const channelByte = buffer.readUInt8(offset);
      const channelNumber = channelByte & 0x1F; // Lower 5 bits
      
      const subpackageByte = buffer.readUInt8(offset + 1);
      const subpackageFlag = (subpackageByte >> 6) & 0x03; // Upper 2 bits
      
      const payloadLength = buffer.readUInt16BE(offset + 2);
      offset += 4;

      // Validate payload length
      if (offset + payloadLength > buffer.length) {
        console.warn(`Invalid payload length: ${payloadLength}, available: ${buffer.length - offset}`);
        return null;
      }

      const header: JTT1078RTPHeader = {
        frameHeader,
        version,
        padding,
        extension,
        csrcCount,
        marker,
        payloadType,
        sequenceNumber,
        timestamp,
        ssrc,
        channelNumber,
        subpackageFlag,
        payloadLength
      };

      const payload = buffer.slice(offset, offset + payloadLength);

      return { header, payload };
    } catch (error) {
      console.error('Failed to parse JT/T 1078 RTP packet:', error);
      return null;
    }
  }

  static isFirstSubpackage(subpackageFlag: number): boolean {
    return subpackageFlag === JTT1078SubpackageFlag.FIRST || subpackageFlag === JTT1078SubpackageFlag.ATOMIC;
  }

  static isLastSubpackage(subpackageFlag: number): boolean {
    return subpackageFlag === JTT1078SubpackageFlag.LAST || subpackageFlag === JTT1078SubpackageFlag.ATOMIC;
  }

  static isCompleteFrame(subpackageFlag: number): boolean {
    return subpackageFlag === JTT1078SubpackageFlag.ATOMIC;
  }
}