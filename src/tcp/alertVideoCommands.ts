import { JTT808Message } from '../types/jtt';

export class AlertVideoCommands {
  
  /**
   * Request 30s before/after video from camera SD card per JTT 1078-2016 Table 24
   * Message ID: 0x9201 - Remote video playback request
   */
  static createAlertVideoRequest(
    vehicleId: string,
    channel: number,
    startTime: Date,
    endTime: Date,
    serverIP: string = '0.0.0.0',
    serverPort: number = 6611
  ): Buffer {
    
    // Convert times to BCD format (YY-MM-DD-HH-MM-SS)
    const startBCD = this.dateToBCD(startTime);
    const endBCD = this.dateToBCD(endTime);
    
    // Build message body per Table 24
    const serverIPBytes = Buffer.from(serverIP, 'utf8');
    const serverIPLength = serverIPBytes.length;
    
    const bodyLength = 1 + serverIPLength + 2 + 2 + 1 + 1 + 1 + 1 + 1 + 1 + 6 + 6;
    const body = Buffer.alloc(bodyLength);
    
    let offset = 0;
    
    // Server IP address length
    body.writeUInt8(serverIPLength, offset++);
    
    // Server IP address
    serverIPBytes.copy(body, offset);
    offset += serverIPLength;
    
    // Server TCP port (set to 0 for UDP only)
    body.writeUInt16BE(0, offset);
    offset += 2;
    
    // Server UDP port
    body.writeUInt16BE(serverPort, offset);
    offset += 2;
    
    // Logical channel number
    body.writeUInt8(channel, offset++);
    
    // Audio and video type (2 = video only)
    body.writeUInt8(2, offset++);
    
    // Stream type (1 = main stream)
    body.writeUInt8(1, offset++);
    
    // Memory type (1 = main storage)
    body.writeUInt8(1, offset++);
    
    // Playback method (0 = normal playback)
    body.writeUInt8(0, offset++);
    
    // Fast forward/rewind multiples (0 = invalid for normal playback)
    body.writeUInt8(0, offset++);
    
    // Start time (BCD format)
    startBCD.copy(body, offset);
    offset += 6;
    
    // End time (BCD format)
    endBCD.copy(body, offset);
    
    return body;
  }
  
  /**
   * Convert Date to BCD format: YY-MM-DD-HH-MM-SS
   */
  private static dateToBCD(date: Date): Buffer {
    const bcd = Buffer.alloc(6);
    
    const year = date.getFullYear() % 100;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    
    bcd[0] = this.toBCD(year);
    bcd[1] = this.toBCD(month);
    bcd[2] = this.toBCD(day);
    bcd[3] = this.toBCD(hour);
    bcd[4] = this.toBCD(minute);
    bcd[5] = this.toBCD(second);
    
    return bcd;
  }
  
  /**
   * Convert decimal to BCD
   */
  private static toBCD(value: number): number {
    return ((Math.floor(value / 10) & 0x0F) << 4) | (value % 10 & 0x0F);
  }
}