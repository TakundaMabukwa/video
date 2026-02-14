import { JTT808Parser } from './parser';

export class ScreenshotCommands {
  static buildSingleFrameRequest(
    vehicleId: string,
    serialNumber: number,
    serverIp: string,
    tcpPort: number,
    udpPort: number,
    channel: number = 1,
    timestamp?: Date
  ): Buffer {
    const serverIpBytes = Buffer.from(serverIp, 'ascii');
    const serverIpLength = serverIpBytes.length;
    
    // Use current time if no timestamp provided
    const frameTime = timestamp || new Date();
    const timeBcd = this.dateToBcd(frameTime);
    
    // Build message body per Table 24
    const bodyLength = 1 + serverIpLength + 2 + 2 + 1 + 1 + 1 + 1 + 1 + 1 + 6 + 6;
    const body = Buffer.alloc(bodyLength);
    
    let offset = 0;
    
    // Server IP address length
    body.writeUInt8(serverIpLength, offset++);
    
    // Server IP address
    serverIpBytes.copy(body, offset);
    offset += serverIpLength;
    
    // Server TCP port
    body.writeUInt16BE(tcpPort, offset);
    offset += 2;
    
    // Server UDP port
    body.writeUInt16BE(udpPort, offset);
    offset += 2;
    
    // Logical channel number
    body.writeUInt8(channel, offset++);
    
    // Audio and video type (2 = video only)
    body.writeUInt8(2, offset++);
    
    // Stream type (0 = main or sub stream)
    body.writeUInt8(0, offset++);
    
    // Memory type (0 = main or disaster recovery)
    body.writeUInt8(0, offset++);
    
    // Playback method (4 = Single frame upload)
    body.writeUInt8(4, offset++);
    
    // Fast forward/rewind multiples (0 = invalid for single frame)
    body.writeUInt8(0, offset++);
    
    // Start time (frame timestamp)
    timeBcd.copy(body, offset);
    offset += 6;
    
    // End time (invalid for single frame - all zeros)
    body.fill(0, offset, offset + 6);
    
    return JTT808Parser.buildResponse(0x9201, vehicleId, serialNumber, body);
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
