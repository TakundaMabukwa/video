import { AbnormalDrivingBehavior, VideoAlarmStatus, LocationAlert, AlarmFlags } from '../types/jtt';

export class AlertParser {
  static parseLocationReport(body: Buffer, vehicleId: string): LocationAlert | null {
    if (body.length < 28) return null;

    // Basic location data (first 28 bytes)
    const alarmFlag = body.readUInt32BE(0);
    const statusFlag = body.readUInt32BE(4);
    const latitude = body.readUInt32BE(8) / 1000000;
    const longitude = body.readUInt32BE(12) / 1000000;
    const altitude = body.readUInt16BE(16);
    const speed = body.readUInt16BE(18) / 10; // Convert from 0.1 km/h to km/h
    const direction = body.readUInt16BE(20);
    const timestamp = this.parseTimestamp(body.slice(22, 28));

    const alert: LocationAlert = {
      vehicleId,
      timestamp,
      latitude,
      longitude,
      speed,
      direction,
      altitude,
      alarmFlags: this.parseAlarmFlags(alarmFlag),
      alarmFlagSetBits: this.getSetBits(alarmFlag, 32),
      rawAlarmFlag: alarmFlag,
      rawStatusFlag: statusFlag
    };

    // Parse additional information (after byte 28)
    let offset = 28;
    while (offset < body.length - 2) {
      const infoId = body.readUInt8(offset);
      const infoLength = body.readUInt8(offset + 1);
      
      if (offset + 2 + infoLength > body.length) break;
      
      const infoData = body.slice(offset + 2, offset + 2 + infoLength);
      
      switch (infoId) {
        case 0x14: // Video-related alarm
          alert.videoAlarms = this.parseVideoAlarms(infoData);
          break;
        case 0x15: // Video signal loss per channel
          alert.signalLossChannels = this.parseChannelBits(infoData);
          break;
        case 0x16: // Video signal blocking per channel
          alert.blockingChannels = this.parseChannelBits(infoData);
          break;
        case 0x17: // Memory failure status
          alert.memoryFailures = this.parseMemoryFailures(infoData);
          break;
        case 0x18: // Abnormal driving behavior details
          alert.drivingBehavior = this.parseAbnormalDriving(infoData);
          break;
      }
      
      offset += 2 + infoLength;
    }

    return alert;
  }

  private static parseVideoAlarms(data: Buffer): VideoAlarmStatus {
    if (data.length < 4) return {} as VideoAlarmStatus;
    
    const flags = data.readUInt32BE(0);
    return {
      videoSignalLoss: !!(flags & (1 << 0)),
      videoSignalBlocking: !!(flags & (1 << 1)),
      storageFailure: !!(flags & (1 << 2)),
      otherVideoFailure: !!(flags & (1 << 3)),
      busOvercrowding: !!(flags & (1 << 4)),
      abnormalDriving: !!(flags & (1 << 5)),
      specialAlarmThreshold: !!(flags & (1 << 6)),
      setBits: this.getSetBits(flags, 32)
    };
  }

  private static parseChannelBits(data: Buffer): number[] {
    if (data.length < 4) return [];
    
    const bits = data.readUInt32BE(0);
    const channels: number[] = [];
    
    for (let i = 0; i < 32; i++) {
      if (bits & (1 << i)) {
        channels.push(i + 1); // Channels are 1-based
      }
    }
    
    return channels;
  }

  private static parseMemoryFailures(data: Buffer): { main: number[]; backup: number[]; } {
    if (data.length < 2) return { main: [], backup: [] };
    
    const bits = data.readUInt16BE(0);
    const main: number[] = [];
    const backup: number[] = [];
    
    // Bits 0-11: main memory units 1-12
    for (let i = 0; i < 12; i++) {
      if (bits & (1 << i)) {
        main.push(i + 1);
      }
    }
    
    // Bits 12-15: backup memory units 1-4
    for (let i = 12; i < 16; i++) {
      if (bits & (1 << i)) {
        backup.push(i - 11);
      }
    }
    
    return { main, backup };
  }

  private static parseAbnormalDriving(data: Buffer): AbnormalDrivingBehavior {
    if (data.length < 3) return {} as AbnormalDrivingBehavior;
    
    const behaviorFlags = data.readUInt16BE(0);
    const fatigueLevel = data.readUInt8(2); // Byte 2: Fatigue level 0-100
    
    return {
      fatigue: !!(behaviorFlags & (1 << 0)),     // bit0: fatigue
      phoneCall: !!(behaviorFlags & (1 << 1)),   // bit1: call  
      smoking: !!(behaviorFlags & (1 << 2)),     // bit2: smoking
      custom: (behaviorFlags >> 11) & 0x1F,      // bits 11-15: custom
      fatigueLevel                                // 0-100 scale per Table 15
    };
  }

  private static parseAlarmFlags(alarmFlag: number): AlarmFlags {
    return {
      emergency: !!(alarmFlag & (1 << 0)),
      overspeed: !!(alarmFlag & (1 << 1)),
      fatigue: !!(alarmFlag & (1 << 2)),
      dangerousDriving: !!(alarmFlag & (1 << 3)),
      overspeedWarning: !!(alarmFlag & (1 << 13)),
      fatigueWarning: !!(alarmFlag & (1 << 14)),
      collisionWarning: !!(alarmFlag & (1 << 31))
    };
  }

  private static bcdToDec(value: number): number {
    return ((value >> 4) & 0x0F) * 10 + (value & 0x0F);
  }

  private static getSetBits(value: number, maxBits: number): number[] {
    const bits: number[] = [];
    for (let i = 0; i < maxBits; i++) {
      if (value & (1 << i)) bits.push(i);
    }
    return bits;
  }

  private static parseTimestamp(data: Buffer): Date {
    // BCD format: YY-MM-DD-HH-MM-SS (spec timestamps are GMT+8)
    const year = 2000 + this.bcdToDec(data[0]);
    const month = this.bcdToDec(data[1]);
    const day = this.bcdToDec(data[2]);
    const hour = this.bcdToDec(data[3]);
    const minute = this.bcdToDec(data[4]);
    const second = this.bcdToDec(data[5]);
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - (8 * 60 * 60 * 1000);

    return new Date(utcMs);
  }
}
