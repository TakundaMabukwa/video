import { JTT808MessageType } from '../types/jtt';

export class JTT1078Commands {
  private static buildSetTerminalParametersCommand(
    terminalPhone: string,
    serialNumber: number,
    params: Array<{ id: number; value: Buffer }>
  ): Buffer {
    const bodyLength =
      1 +
      params.reduce((sum, item) => sum + 4 + 1 + item.value.length, 0);
    const body = Buffer.alloc(bodyLength);
    let offset = 0;

    body.writeUInt8(params.length, offset++);
    for (const item of params) {
      body.writeUInt32BE(item.id >>> 0, offset);
      offset += 4;
      body.writeUInt8(item.value.length, offset++);
      item.value.copy(body, offset);
      offset += item.value.length;
    }

    return this.buildMessage(0x8103, terminalPhone, serialNumber, body);
  }

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
    options?: {
      alarmFlag64?: bigint;
      resourceType?: number; // 0=audio+video, 1=audio, 2=video, 3=video or audio
      streamType?: number; // 0=all, 1=main, 2=sub
      storageType?: number; // 0=all, 1=main, 2=disaster
    }
  ): Buffer {
    const body = Buffer.alloc(24);
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
    
    // Alarm flag (64 bits)
    body.writeBigUInt64BE(options?.alarmFlag64 ?? 0n, offset);
    offset += 8;

    // Resource type
    body.writeUInt8(options?.resourceType ?? 2, offset++); // default video

    // Stream type
    body.writeUInt8(options?.streamType ?? 0, offset++); // default all streams

    // Storage type
    body.writeUInt8(options?.storageType ?? 0, offset++); // default all storage
    
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

  // Build 0x9206 command - File upload command (terminal uploads recording file via FTP)
  static buildFileUploadCommand(
    terminalPhone: string,
    serialNumber: number,
    ftpHost: string,
    ftpPort: number,
    ftpUsername: string,
    ftpPassword: string,
    ftpPath: string,
    channelId: number,
    startTime: Date,
    endTime: Date,
    options?: {
      alarmFlag64?: bigint;
      resourceType?: number; // 0=audio+video, 1=audio, 2=video, 3=video or audio
      streamType?: number; // 0=main or sub, 1=main, 2=sub
      storageLocation?: number; // 0=main or disaster, 1=main, 2=disaster
      taskExecutionConditions?: number; // bit0 wifi, bit1 lan, bit2 3g/4g
    }
  ): Buffer {
    const host = Buffer.from(ftpHost, 'utf8');
    const user = Buffer.from(ftpUsername, 'utf8');
    const pass = Buffer.from(ftpPassword, 'utf8');
    const uploadPath = Buffer.from(ftpPath, 'utf8');
    const startBcd = this.dateToBcd(startTime);
    const endBcd = this.dateToBcd(endTime);

    const bodyLength =
      1 + host.length +
      2 +
      1 + user.length +
      1 + pass.length +
      1 + uploadPath.length +
      1 +
      6 +
      6 +
      8 +
      1 +
      1 +
      1 +
      1;

    const body = Buffer.alloc(bodyLength);
    let offset = 0;

    body.writeUInt8(host.length, offset++);
    host.copy(body, offset); offset += host.length;

    body.writeUInt16BE(ftpPort, offset); offset += 2;

    body.writeUInt8(user.length, offset++);
    user.copy(body, offset); offset += user.length;

    body.writeUInt8(pass.length, offset++);
    pass.copy(body, offset); offset += pass.length;

    body.writeUInt8(uploadPath.length, offset++);
    uploadPath.copy(body, offset); offset += uploadPath.length;

    body.writeUInt8(channelId, offset++);

    startBcd.copy(body, offset); offset += 6;
    endBcd.copy(body, offset); offset += 6;

    body.writeBigUInt64BE(options?.alarmFlag64 ?? 0n, offset); offset += 8;

    body.writeUInt8(options?.resourceType ?? 2, offset++); // video
    body.writeUInt8(options?.streamType ?? 1, offset++); // main stream
    body.writeUInt8(options?.storageLocation ?? 1, offset++); // main storage
    body.writeUInt8(options?.taskExecutionConditions ?? 0b010, offset++); // LAN

    return this.buildMessage(0x9206, terminalPhone, serialNumber, body);
  }

  // Build 0x8103 command - Set video parameters (resolution, bitrate, frame rate)
  static buildSetVideoParametersCommand(
    terminalPhone: string,
    serialNumber: number,
    channel: number,
    resolution: number = 1, // 0=QCIF, 1=CIF, 2=WCIF, 3=D1, 4=WD1
    frameRate: number = 15,
    bitrate: number = 512
  ): Buffer {
    const value = Buffer.alloc(21);
    let offset = 0;

    value.writeUInt8(channel, offset++);           // Logical channel
    value.writeUInt8(0, offset++);                 // CBR encoding
    value.writeUInt8(resolution, offset++);        // Resolution
    value.writeUInt16BE(2, offset); offset += 2;   // I-frame every 2s
    value.writeUInt8(frameRate, offset++);         // Frame rate
    value.writeUInt32BE(bitrate, offset); offset += 4; // Bitrate
    value.writeUInt8(0, offset++);                 // Save: CBR
    value.writeUInt8(resolution, offset++);        // Save: Resolution
    value.writeUInt16BE(2, offset); offset += 2;   // Save: I-frame
    value.writeUInt8(frameRate, offset++);         // Save: Frame rate
    value.writeUInt32BE(bitrate, offset); offset += 4; // Save: Bitrate
    value.writeUInt16BE(0, offset);                // OSD settings

    return this.buildSetTerminalParametersCommand(terminalPhone, serialNumber, [
      { id: 0x0077, value }
    ]);
  }

  // Build 0x8103 command - Set video alarm masking word (0x007A)
  static buildSetVideoAlarmMaskCommand(
    terminalPhone: string,
    serialNumber: number,
    maskWord: number = 0
  ): Buffer {
    const value = Buffer.alloc(4);
    value.writeUInt32BE(maskWord >>> 0, 0);
    return this.buildSetTerminalParametersCommand(terminalPhone, serialNumber, [
      { id: 0x007A, value }
    ]);
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
