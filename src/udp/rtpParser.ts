import { JTT1078RTPHeader, JTT1078SubpackageFlag } from '../types/jtt';

export class JTT1078RTPParser {
  static parseRTPPacket(buffer: Buffer): { header: JTT1078RTPHeader; payload: Buffer; dataType: number } | null {
    if (buffer.length < 30) {
      return null;
    }

    try {
      const frameHeader = buffer.readUInt32BE(0);
      if (frameHeader !== 0x30316364) {
        return null;
      }

      const rtpByte = buffer.readUInt8(4);
      const version = (rtpByte >> 6) & 0x03;
      const padding = ((rtpByte >> 5) & 0x01) === 1;
      const extension = ((rtpByte >> 4) & 0x01) === 1;
      const csrcCount = rtpByte & 0x0F;

      const markerAndPT = buffer.readUInt8(5);
      const marker = ((markerAndPT >> 7) & 0x01) === 1;
      const payloadType = markerAndPT & 0x7F;

      const sequenceNumber = buffer.readUInt16BE(6);

      // Parse SIM card (BCD encoded, 6 bytes at offset 8-13)
      const simCardBytes = buffer.slice(8, 14);
      const simCard = this.parseBCD(simCardBytes);
      
      if (!simCard || simCard.length === 0) {
        return null;
      }

      // Logical channel number at byte 14
      const channelNumber = buffer.readUInt8(14);

      // Data type (upper 4 bits) and subpackage flag (lower 4 bits) at byte 15
      const dataTypeByte = buffer.readUInt8(15);
      const dataType = (dataTypeByte >> 4) & 0x0F;
      const subpackageFlag = dataTypeByte & 0x0F;

      let offset = 16;
      let timestamp: bigint | undefined;
      let lastIFrameInterval: number | undefined;
      let lastFrameInterval: number | undefined;

      // Timestamp (8 bytes) - only if NOT transparent data (0x04)
      if (dataType !== 0x04) {
        if (offset + 8 > buffer.length) return null;
        timestamp = buffer.readBigUInt64BE(offset);
        offset += 8;

        // Last I-frame interval and last frame interval - only for video frames
        if (dataType <= 0x02) {
          if (offset + 4 > buffer.length) return null;
          lastIFrameInterval = buffer.readUInt16BE(offset);
          lastFrameInterval = buffer.readUInt16BE(offset + 2);
          offset += 4;
        }
      }

      // Data body length at current offset
      if (offset + 2 > buffer.length) return null;
      const payloadLength = buffer.readUInt16BE(offset);
      offset += 2;

      // Validate payload length (max 950 bytes per spec)
      if (payloadLength > 950 || offset + payloadLength > buffer.length) {
        console.warn(`Invalid payload: ${payloadLength} bytes, available: ${buffer.length - offset}`);
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
        simCard,
        channelNumber,
        dataType,
        subpackageFlag,
        timestamp,
        lastIFrameInterval,
        lastFrameInterval,
        payloadLength
      };

      const payload = buffer.slice(offset, offset + payloadLength);
      return { header, payload, dataType };
    } catch (error) {
      console.error('Failed to parse JT/T 1078 RTP packet:', error);
      return null;
    }
  }

  private static parseBCD(buffer: Buffer): string {
    let result = '';
    for (let i = 0; i < buffer.length; i++) {
      const high = (buffer[i] >> 4) & 0x0F;
      const low = buffer[i] & 0x0F;
      result += high.toString() + low.toString();
    }
    return result;
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
