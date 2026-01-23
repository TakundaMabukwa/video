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

  // Build 0x9101 command - Start real-time audio/video transmission (Table 17)
  static buildStartVideoCommand(
    terminalPhone: string,
    serialNumber: number,
    serverIp: string,
    tcpPort: number,
    udpPort: number,
    channelNumber: number = 1,
    dataType: number = 0, // 0=audio/video, 1=video, 2=bidirectional, 3=monitor, 4=broadcast, 5=transparent
    streamType: number = 0 // 0=main stream, 1=sub stream
  ): Buffer {
    const ipLength = serverIp.length;
    const body = Buffer.alloc(1 + ipLength + 2 + 2 + 1 + 1 + 1);
    let offset = 0;
    
    // Server IP address length (1 byte)
    body.writeUInt8(ipLength, offset++);
    
    // Server IP address (STRING)
    body.write(serverIp, offset, 'ascii');
    offset += ipLength;
    
    // Server TCP port (2 bytes)
    body.writeUInt16BE(tcpPort, offset);
    offset += 2;
    
    // Server UDP port (2 bytes)
    body.writeUInt16BE(udpPort, offset);
    offset += 2;
    
    // Logical channel number (1 byte)
    body.writeUInt8(channelNumber, offset++);
    
    // Data type (1 byte)
    body.writeUInt8(dataType, offset++);
    
    // Stream type (1 byte)
    body.writeUInt8(streamType, offset++);
    
    return this.buildMessage(JTT808MessageType.START_VIDEO_REQUEST, terminalPhone, serialNumber, body);
  }

  // Build 0x9205 command - Query resource list
  static buildQueryResourceListCommand(
    terminalPhone: string,
    serialNumber: number,
    channelId: number,
    startTime: Date,
    endTime: Date,
    alarmType: number = 0, // 0=all, 1-7=specific alarm types
    mediaType: number = 0, // 0=audio+video, 1=audio, 2=video, 3=audio or video
    streamType: number = 0 // 0=all, 1=main, 2=sub
  ): Buffer {
    const body = Buffer.alloc(18);
    let offset = 0;
    
    // Channel ID (1 byte)
    body.writeUInt8(channelId, offset++);
    
    // Start time (6 bytes BCD)
    const startBcd = this.dateToBcd(startTime);
    startBcd.copy(body, offset);
    offset += 6;
    
    // End time (6 bytes BCD)
    const endBcd = this.dateToBcd(endTime);
    endBcd.copy(body, offset);
    offset += 6;
    
    // Alarm type (1 byte)
    body.writeUInt8(alarmType, offset++);
    
    // Media type (1 byte)
    body.writeUInt8(mediaType, offset++);
    
    // Stream type (1 byte)
    body.writeUInt8(streamType, offset++);
    
    // Storage type (1 byte) - 0=all, 1=main, 2=disaster recovery
    body.writeUInt8(0, offset++);
    
    return this.buildMessage(0x9205, terminalPhone, serialNumber, body);
  }

  // Build 0x9201 command - Remote video playback request
  static buildPlaybackCommand(
    terminalPhone: string,
    serialNumber: number,
    serverIp: string,
    serverPort: number,
    channelId: number,
    startTime: Date,
    endTime: Date,
    playbackMethod: number = 0 // 0=normal, 1=fast forward, 2=key frames, 3=key frames + sub, 4=single frame
  ): Buffer {
    const body = Buffer.alloc(21);
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
    
    // Playback method (1 byte)
    body.writeUInt8(playbackMethod, offset++);
    
    // Fast forward/rewind multiple (1 byte)
    body.writeUInt8(0, offset++);
    
    // Start time (6 bytes BCD)
    const startBcd = this.dateToBcd(startTime);
    startBcd.copy(body, offset);
    offset += 6;
    
    // End time (6 bytes BCD) - set to 0 for single frame
    if (playbackMethod === 4) {
      body.fill(0, offset, offset + 6);
    } else {
      const endBcd = this.dateToBcd(endTime);
      endBcd.copy(body, offset);
    }
    
    return this.buildMessage(0x9201, terminalPhone, serialNumber, body);
  }

  // Build 0x9102 command - Audio/video transmission control (switch stream, pause, resume)
  static buildStreamControlCommand(
    terminalPhone: string,
    serialNumber: number,
    channelNumber: number,
    controlInstruction: number, // 0=close, 1=switch stream, 2=pause, 3=resume, 4=close intercom
    closeType: number = 0, // 0=close all, 1=close audio only, 2=close video only
    switchStreamType: number = 1 // 0=main stream, 1=sub stream
  ): Buffer {
    const body = Buffer.alloc(4);
    body.writeUInt8(channelNumber, 0);
    body.writeUInt8(controlInstruction, 1);
    body.writeUInt8(closeType, 2);
    body.writeUInt8(switchStreamType, 3);
    
    return this.buildMessage(0x9102, terminalPhone, serialNumber, body);
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

  private static dateToBcd(date: Date): Buffer {
    const year = date.getFullYear() % 100;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    
    const bcd = Buffer.alloc(6);
    bcd[0] = this.toBcd(year);
    bcd[1] = this.toBcd(month);
    bcd[2] = this.toBcd(day);
    bcd[3] = this.toBcd(hour);
    bcd[4] = this.toBcd(minute);
    bcd[5] = this.toBcd(second);
    
    return bcd;
  }
  
  private static toBcd(value: number): number {
    return ((Math.floor(value / 10) & 0x0F) << 4) | (value % 10 & 0x0F);
  }
}