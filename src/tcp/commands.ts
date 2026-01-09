import { JTT808MessageType } from '../types/jtt';

export class JTT1078Commands {
  // Build 0x9003 command - Query audio/video capabilities
  static buildQueryCapabilitiesCommand(
    terminalPhone: string,
    serialNumber: number
  ): Buffer {
    const body = Buffer.alloc(0); // Empty body
    return this.buildMessage(0x9003, terminalPhone, serialNumber, body);
  }

  // Build 0x9101 command - Start real-time audio/video transmission
  static buildStartVideoCommand(
    terminalPhone: string,
    serialNumber: number,
    serverIp: string,
    serverPort: number,
    channelNumber: number = 1,
    dataType: number = 0, // 0=audio/video, 1=video, 2=bidirectional audio, 3=audio
    streamType: number = 0 // 0=main stream, 1=sub stream
  ): Buffer {
    const body = Buffer.alloc(16);
    
    // Server IP (4 bytes)
    const ipParts = serverIp.split('.').map(Number);
    body.writeUInt8(ipParts[0], 0);
    body.writeUInt8(ipParts[1], 1);
    body.writeUInt8(ipParts[2], 2);
    body.writeUInt8(ipParts[3], 3);
    
    // Server port (2 bytes)
    body.writeUInt16BE(serverPort, 4);
    
    // Channel number (1 byte)
    body.writeUInt8(channelNumber, 6);
    
    // Data type (1 byte)
    body.writeUInt8(dataType, 7);
    
    // Stream type (1 byte) 
    body.writeUInt8(streamType, 8);
    
    // Reserved bytes (7 bytes)
    body.fill(0, 9, 16);
    
    return this.buildMessage(JTT808MessageType.START_VIDEO_REQUEST, terminalPhone, serialNumber, body);
  }

  // Build 0x9201 command - Remote video playback request (screenshot)
  static buildScreenshotCommand(
    terminalPhone: string,
    serialNumber: number,
    serverIp: string,
    serverPort: number,
    channelId: number = 1
  ): Buffer {
    const body = Buffer.alloc(16);
    let offset = 0;
    
    // Server IP (4 bytes)
    const ipParts = serverIp.split('.').map(Number);
    body.writeUInt8(ipParts[0], offset++);
    body.writeUInt8(ipParts[1], offset++);
    body.writeUInt8(ipParts[2], offset++);
    body.writeUInt8(ipParts[3], offset++);
    
    // Server port (2 bytes)
    body.writeUInt16BE(serverPort, offset);
    offset += 2;
    
    // Channel ID (1 byte)
    body.writeUInt8(channelId, offset++);
    
    // Playback method: 4 = Single frame upload (1 byte)
    body.writeUInt8(4, offset++);
    
    // Fast forward multiple (1 byte) - not used for single frame
    body.writeUInt8(0, offset++);
    
    // Timestamp (6 bytes BCD) - current time
    const now = new Date();
    const year = now.getFullYear() % 100;
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    
    body.writeUInt8(parseInt(year.toString().padStart(2, '0'), 16), offset++);
    body.writeUInt8(parseInt(month.toString().padStart(2, '0'), 16), offset++);
    body.writeUInt8(parseInt(day.toString().padStart(2, '0'), 16), offset++);
    body.writeUInt8(parseInt(hour.toString().padStart(2, '0'), 16), offset++);
    body.writeUInt8(parseInt(minute.toString().padStart(2, '0'), 16), offset++);
    body.writeUInt8(parseInt(second.toString().padStart(2, '0'), 16), offset++);
    
    return this.buildMessage(0x9201, terminalPhone, serialNumber, body);
  }

  // Build general platform response (0x8001)
  static buildGeneralResponse(
    terminalPhone: string,
    serialNumber: number,
    responseSerialNumber: number,
    responseMessageId: number,
    result: number = 0 // 0=success, 1=failure, 2=message error, 3=not supported
  ): Buffer {
    const body = Buffer.alloc(5);
    body.writeUInt16BE(responseSerialNumber, 0);
    body.writeUInt16BE(responseMessageId, 2);
    body.writeUInt8(result, 4);
    
    return this.buildMessage(JTT808MessageType.PLATFORM_GENERAL_RESPONSE, terminalPhone, serialNumber, body);
  }

  private static buildMessage(messageId: number, terminalPhone: string, serialNumber: number, body: Buffer): Buffer {
    const phoneBytes = this.stringToBcd(terminalPhone);
    const bodyLength = body.length;
    
    // Build message
    const message = Buffer.alloc(13 + bodyLength);
    message.writeUInt16BE(messageId, 0);
    message.writeUInt16BE(bodyLength, 2);
    phoneBytes.copy(message, 4);
    message.writeUInt16BE(serialNumber, 10);
    body.copy(message, 12);
    
    // Calculate and set checksum
    const checksum = this.calculateChecksum(message);
    message[12 + bodyLength] = checksum;
    
    // Escape and add frame delimiters
    const escaped = this.escape(message);
    const result = Buffer.alloc(escaped.length + 2);
    result[0] = 0x7E;
    escaped.copy(result, 1);
    result[result.length - 1] = 0x7E;
    
    return result;
  }

  private static escape(buffer: Buffer): Buffer {
    const result: number[] = [];
    for (const byte of buffer) {
      if (byte === 0x7E) {
        result.push(0x7D, 0x02);
      } else if (byte === 0x7D) {
        result.push(0x7D, 0x01);
      } else {
        result.push(byte);
      }
    }
    return Buffer.from(result);
  }

  private static calculateChecksum(buffer: Buffer): number {
    let checksum = 0;
    for (const byte of buffer) {
      checksum ^= byte;
    }
    return checksum;
  }

  private static stringToBcd(str: string): Buffer {
    const padded = str.padStart(12, '0');
    return Buffer.from(padded, 'hex');
  }
}