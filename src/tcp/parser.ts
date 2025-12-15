import { JTT808Message, JTT808MessageType } from '../types/jtt';

export class JTT808Parser {
  // JT/T 808 message structure: 0x7E + Header + Body + Checksum + 0x7E
  static parseMessage(buffer: Buffer): JTT808Message | null {
    if (buffer.length < 12 || buffer[0] !== 0x7E || buffer[buffer.length - 1] !== 0x7E) {
      return null;
    }

    try {
      // Unescape 0x7D sequences
      const unescaped = this.unescape(buffer.slice(1, -1));
      
      const messageId = unescaped.readUInt16BE(0);
      const bodyProps = unescaped.readUInt16BE(2);
      const bodyLength = bodyProps & 0x3FF; // Lower 10 bits
      
      // Terminal phone (BCD, 6 bytes)
      const phoneBytes = unescaped.slice(4, 10);
      const terminalPhone = this.bcdToString(phoneBytes);
      
      const serialNumber = unescaped.readUInt16BE(10);
      const body = unescaped.slice(12, 12 + bodyLength);
      const checksum = unescaped[12 + bodyLength];
      
      // Verify checksum
      const calculatedChecksum = this.calculateChecksum(unescaped.slice(0, 12 + bodyLength));
      if (checksum !== calculatedChecksum) {
        console.warn(`Checksum mismatch: expected ${checksum}, got ${calculatedChecksum}`);
      }

      return {
        messageId,
        bodyLength,
        terminalPhone,
        serialNumber,
        body,
        checksum
      };
    } catch (error) {
      console.error('Failed to parse JT/T 808 message:', error);
      return null;
    }
  }

  static buildResponse(messageId: number, terminalPhone: string, serialNumber: number, body: Buffer = Buffer.alloc(0)): Buffer {
    const phoneBytes = this.stringToBcd(terminalPhone);
    const bodyLength = body.length;
    
    // Build message without escape sequences
    const message = Buffer.alloc(13 + bodyLength);
    message.writeUInt16BE(messageId, 0);
    message.writeUInt16BE(bodyLength, 2);
    phoneBytes.copy(message, 4);
    message.writeUInt16BE(serialNumber, 10);
    body.copy(message, 12);
    
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

  private static unescape(buffer: Buffer): Buffer {
    const result: number[] = [];
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x7D && i + 1 < buffer.length) {
        if (buffer[i + 1] === 0x01) {
          result.push(0x7D);
          i++;
        } else if (buffer[i + 1] === 0x02) {
          result.push(0x7E);
          i++;
        } else {
          result.push(buffer[i]);
        }
      } else {
        result.push(buffer[i]);
      }
    }
    return Buffer.from(result);
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

  private static bcdToString(buffer: Buffer): string {
    return buffer.toString('hex').replace(/^0+/, '') || '0';
  }

  private static stringToBcd(str: string): Buffer {
    const padded = str.padStart(12, '0');
    return Buffer.from(padded, 'hex');
  }
}