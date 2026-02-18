import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { JTT808Parser } from './parser';
import { JTT1078Commands } from './commands';
import { ScreenshotCommands } from './screenshotCommands';
import { AlertParser } from './alertParser';
import { MultimediaParser } from './multimediaParser';
import { AlertVideoCommands } from './alertVideoCommands';
import { AlertStorageDB } from '../storage/alertStorageDB';
import { DeviceStorage } from '../storage/deviceStorage';
import { ImageStorage } from '../storage/imageStorage';
import { AlertManager } from '../alerts/alertManager';
import { JTT808MessageType, Vehicle, LocationAlert, VehicleChannel } from '../types/jtt';

type ScreenshotFallbackResult = {
  ok: boolean;
  imageId?: string;
  reason?: string;
  videoEvidencePath?: string;
  videoEvidenceReason?: string;
};

export class JTT808Server {
  private server: net.Server;
  private vehicles = new Map<string, Vehicle>();
  private connections = new Map<string, net.Socket>();
  private socketToVehicle = new Map<net.Socket, string>();
  private ipToVehicle = new Map<string, string>(); // Map IP to vehicle ID
  private serialCounter = 1;
  private rtpHandler?: (buffer: Buffer, vehicleId: string) => void;
  private alertStorage = new AlertStorageDB();
  private deviceStorage = new DeviceStorage();
  private imageStorage = new ImageStorage();
  private alertManager: AlertManager;

  private getNextSerial(): number {
    this.serialCounter = (this.serialCounter % 65535) + 1;
    return this.serialCounter;
  }

  constructor(private port: number, private udpPort: number) {
    this.server = net.createServer(this.handleConnection.bind(this));
    this.alertManager = new AlertManager();
    
    // Listen for screenshot requests from alert manager
    this.alertManager.on('request-screenshot', ({ vehicleId, channel, alertId }) => {
      console.log(`Alert ${alertId}: Requesting screenshot from ${vehicleId} channel ${channel}`);
      void this.requestScreenshotWithFallback(vehicleId, channel, {
        fallback: true,
        fallbackDelayMs: 700,
        alertId,
        captureVideoEvidence: true,
        videoDurationSec: 8
      });
    });
    
    // Listen for camera video requests from alert manager
    this.alertManager.on('request-camera-video', ({ vehicleId, channel, startTime, endTime, alertId }) => {
      console.log(`🎥 Alert ${alertId}: Requesting camera SD card video from ${vehicleId} channel ${channel}`);
      this.requestCameraVideo(vehicleId, channel, startTime, endTime);
    });

    this.alertManager.on('request-camera-video-download', ({ vehicleId, channel, startTime, endTime, alertId }) => {
      console.log(`Alert ${alertId}: Requesting camera SD card FTP upload from ${vehicleId} channel ${channel}`);
      this.requestCameraVideoDownload(vehicleId, channel, startTime, endTime);
    });
  }

  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  setRTPHandler(handler: (buffer: Buffer, vehicleId: string) => void): void {
    this.rtpHandler = handler;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`JT/T 808 TCP server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    let buffer = Buffer.alloc(0);
    
    socket.on('data', async (data) => {
      console.log(`[${clientAddr}] ${data.length}B: ${data.toString('hex').substring(0, 100)}${data.length > 50 ? '...' : ''}`);
      buffer = Buffer.concat([buffer, data]);
      
      const rtpMagic = Buffer.from([0x30, 0x31, 0x63, 0x64]);

      // Process complete messages
      while (buffer.length > 0) {
        // Skip duplicated delimiters (some devices send 0x7E 0x7E between frames)
        while (buffer.length >= 2 && buffer[0] === 0x7E && buffer[1] === 0x7E) {
          buffer = buffer.slice(1);
        }

        // Check for RTP video data first (0x30316364)
        if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x30316364) {
          // Parse data type at offset 15 to determine header size
          if (buffer.length < 16) break; // Need at least 16 bytes
          
          const dataTypeByte = buffer.readUInt8(15);
          const dataType = (dataTypeByte >> 4) & 0x0F;
          
          // Calculate payload length offset based on data type
          let payloadLengthOffset = 16;
          if (dataType !== 0x04) {
            payloadLengthOffset += 8; // timestamp
            if (dataType <= 0x02) {
              payloadLengthOffset += 4; // I-frame + frame intervals
            }
          }
          
          if (buffer.length < payloadLengthOffset + 2) break; // Need payload length field
          
          const payloadLength = buffer.readUInt16BE(payloadLengthOffset);
          const totalLength = payloadLengthOffset + 2 + payloadLength;
          
          if (buffer.length >= totalLength) {
            const rtpPacket = buffer.slice(0, totalLength);
            buffer = buffer.slice(totalLength);
            this.handleRTPData(rtpPacket, socket);
            continue;
          }
          break; // Wait for more data
        }

        // Check for JT/T 808 frame when aligned to delimiter
        if (buffer[0] === 0x7E) {
          const messageEnd = buffer.indexOf(0x7E, 1);
          if (messageEnd === -1) break;

          const frameLength = messageEnd + 1;
          // Guardrail: malformed oversized/undersized frame; resync by one byte.
          if (frameLength < 15 || frameLength > 8192) {
            buffer = buffer.slice(1);
            continue;
          }

          const messageBuffer = buffer.slice(0, frameLength);
          buffer = buffer.slice(frameLength);

          await this.processMessage(messageBuffer, socket);
          continue;
        }

        // Not aligned to either protocol; resync to the nearest known marker.
        const next808 = buffer.indexOf(0x7E);
        const nextRtp = buffer.indexOf(rtpMagic);

        if (next808 === -1 && nextRtp === -1) {
          buffer = Buffer.alloc(0);
          break;
        }

        let next = -1;
        if (next808 === -1) next = nextRtp;
        else if (nextRtp === -1) next = next808;
        else next = Math.min(next808, nextRtp);

        if (next <= 0) {
          // Safety fallback: drop one byte to avoid infinite loops.
          buffer = buffer.slice(1);
        } else {
          buffer = buffer.slice(next);
        }
      }
    });

    socket.on('close', () => {
      
      this.handleDisconnection(socket);
    });

    socket.on('error', (error) => {
      console.error(`TCP socket error:`, error);
    });
  }

  private async processMessage(buffer: Buffer, socket: net.Socket): Promise<void> {
    const message = JTT808Parser.parseMessage(buffer);
    if (!message) {
      console.warn('Failed to parse JT/T 808 message');
      return;
    }

    

    switch (message.messageId) {
      case JTT808MessageType.TERMINAL_REGISTER:
        this.handleTerminalRegister(message, socket);
        break;
      case JTT808MessageType.TERMINAL_AUTH:
        this.handleTerminalAuth(message, socket);
        break;
      case JTT808MessageType.HEARTBEAT:
        this.handleHeartbeat(message, socket);
        break;
      case JTT808MessageType.LOCATION_REPORT:
        this.handleLocationReport(message, socket);
        break;
      case 0x0001:
        console.log(`Terminal general response from ${message.terminalPhone}:`);
        if (message.body.length >= 5) {
          const replySerial = message.body.readUInt16BE(0);
          const replyMsgId = message.body.readUInt16BE(2);
          const result = message.body.readUInt8(4);
          console.log(`   Reply to: 0x${replyMsgId.toString(16).padStart(4, '0')} (serial ${replySerial})`);
          console.log(`   Result: ${result === 0 ? 'Success' : result === 1 ? 'Failure' : result === 2 ? 'Message error' : 'Not supported'}`);
          
          if (replyMsgId === 0x9101) {
            console.log(`   Video stream request acknowledged - waiting for RTP data...`);
          } else if (replyMsgId === 0x9003) {
            console.log(`   Capabilities query acknowledged`);
          }
        }
        break;
      case 0x1003: // Audio/video capabilities response
        console.log(`📋 Capabilities response from ${message.terminalPhone}`);
        this.parseCapabilities(message.body, message.terminalPhone);
        break;
      case 0x1205: // Resource list response
        console.log(`📝 Resource list response (0x1205) from ${message.terminalPhone}`);
        
        this.parseResourceList(message.body);
        break;
      case 0x1206: // File upload completion notification
        console.log(`File upload completion (0x1206) from ${message.terminalPhone}`);
        if (message.body.length >= 3) {
          const responseSerial = message.body.readUInt16BE(0);
          const result = message.body.readUInt8(2);
          console.log(`   Response serial: ${responseSerial}`);
          console.log(`   Upload result: ${result === 0 ? 'success' : 'failure'}`);
        }
        break;
      case 0x0800: // Multimedia event message upload
        this.handleMultimediaEvent(message, socket);
        break;
      case 0x0801: // Multimedia data upload
        if (message.isSubpackage) {
          console.log(`📦 0x0801 subpackage ${message.packetIndex}/${message.packetCount} from ${message.terminalPhone}, body=${message.body.length}`);
        }
        await this.handleMultimediaData(message, socket);
        break;
      case 0x0704: // Custom/proprietary message
        this.handleCustomMessage(message, socket);
        break;
      default:
        
    }
  }

  private handleRTPData(buffer: Buffer, socket: net.Socket): void {
    // Use IP address as vehicle ID (cameras use multiple sockets)
    const clientIp = socket.remoteAddress?.replace('::ffff:', '') || '';
    const vehicleId = this.ipToVehicle.get(clientIp) || clientIp; // Fallback to IP if not registered
    
    if (this.rtpHandler) {
      this.rtpHandler(buffer, vehicleId);
    }
  }

  private handleTerminalRegister(message: any, socket: net.Socket): void {
    const ipAddress = socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
    this.deviceStorage.upsertDevice(message.terminalPhone, ipAddress);
    
    const vehicle: Vehicle = {
      id: message.terminalPhone,
      phone: message.terminalPhone,
      connected: true,
      lastHeartbeat: new Date(),
      activeStreams: new Set()
    };
    
    this.vehicles.set(message.terminalPhone, vehicle);
    this.connections.set(message.terminalPhone, socket);
    this.socketToVehicle.set(socket, message.terminalPhone);
    this.ipToVehicle.set(ipAddress, message.terminalPhone); // Map IP to vehicle
    
    console.log(`✅ Vehicle registered: ${message.terminalPhone} from ${ipAddress}`);
    
    // Send proper 0x8100 registration response with auth token
    const authToken = Buffer.from('AUTH123456', 'ascii');
    const responseBody = Buffer.alloc(3 + authToken.length);
    responseBody.writeUInt16BE(message.serialNumber, 0);
    responseBody.writeUInt8(0, 2); // Success
    authToken.copy(responseBody, 3);
    
    const response = this.buildMessage(0x8100, message.terminalPhone, this.getNextSerial(), responseBody);
    
    // Check if socket is writable before sending
    if (socket.writable) {
      socket.write(response);
      socket.setKeepAlive(true, 30000);
    }
  }

  private buildMessage(messageId: number, phone: string, serial: number, body: Buffer): Buffer {
    const phoneBytes = this.stringToBcd(phone);
    const message = Buffer.alloc(13 + body.length);
    message.writeUInt16BE(messageId, 0);
    message.writeUInt16BE(body.length, 2);
    phoneBytes.copy(message, 4);
    message.writeUInt16BE(serial, 10);
    body.copy(message, 12);
    
    const checksum = this.calculateChecksum(message);
    message[12 + body.length] = checksum;
    
    const escaped = this.escape(message);
    const result = Buffer.alloc(escaped.length + 2);
    result[0] = 0x7E;
    escaped.copy(result, 1);
    result[result.length - 1] = 0x7E;
    
    return result;
  }

  private stringToBcd(str: string): Buffer {
    const padded = str.padStart(12, '0');
    return Buffer.from(padded, 'hex');
  }

  private escape(buffer: Buffer): Buffer {
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

  private calculateChecksum(buffer: Buffer): number {
    let checksum = 0;
    for (const byte of buffer) {
      checksum ^= byte;
    }
    return checksum;
  }

  private handleTerminalAuth(message: any, socket: net.Socket): void {
    const ipAddress = socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
    
    // If vehicle doesn't exist, create it (camera skipped registration)
    if (!this.vehicles.has(message.terminalPhone)) {
      this.deviceStorage.upsertDevice(message.terminalPhone, ipAddress);
      
      const vehicle: Vehicle = {
        id: message.terminalPhone,
        phone: message.terminalPhone,
        connected: true,
        lastHeartbeat: new Date(),
        activeStreams: new Set()
      };
      this.vehicles.set(message.terminalPhone, vehicle);
      this.connections.set(message.terminalPhone, socket);
      this.socketToVehicle.set(socket, message.terminalPhone);
      this.ipToVehicle.set(ipAddress, message.terminalPhone); // Map IP to vehicle
      
      console.log(`✅ Camera authenticated: ${message.terminalPhone} from ${ipAddress}`);
      
      // Query capabilities to discover channels
      setTimeout(() => {
        console.log(`🔍 Querying capabilities for ${message.terminalPhone}...`);
        this.queryCapabilities(message.terminalPhone);
      }, 1000);
    }
    
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    
    socket.write(response);
  }

  private handleHeartbeat(message: any, socket: net.Socket): void {
    const vehicle = this.vehicles.get(message.terminalPhone);
    if (vehicle) {
      vehicle.lastHeartbeat = new Date();
    }
    
    // Send heartbeat response
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    
    socket.write(response);
  }

  private handleLocationReport(message: any, socket: net.Socket): void {
    console.log(`\n📍 Location Report from ${message.terminalPhone}`);
    console.log(`Body length: ${message.body.length} bytes`);
    console.log(`Body hex: ${message.body.toString('hex')}`);
    
    // Parse basic location (first 28 bytes)
    if (message.body.length >= 28) {
      const alarmFlag = message.body.readUInt32BE(0);
      const statusFlag = message.body.readUInt32BE(4);
      const lat = message.body.readUInt32BE(8) / 1000000;
      const lon = message.body.readUInt32BE(12) / 1000000;
      console.log(`Alarm flags: 0x${alarmFlag.toString(16).padStart(8, '0')}`);
      console.log(`Status flags: 0x${statusFlag.toString(16).padStart(8, '0')}`);
      console.log(`Location: ${lat}, ${lon}`);
      
      // Parse additional info fields
      let offset = 28;
      console.log(`\nAdditional Info Fields:`);
      while (offset < message.body.length - 2) {
        const infoId = message.body.readUInt8(offset);
        const infoLength = message.body.readUInt8(offset + 1);
        
        if (offset + 2 + infoLength > message.body.length) break;
        
        const infoData = message.body.slice(offset + 2, offset + 2 + infoLength);
        console.log(`  ID: 0x${infoId.toString(16).padStart(2, '0')} | Length: ${infoLength} | Data: ${infoData.toString('hex')}`);
        
        // Decode known alert fields
        if (infoId === 0x14) console.log(`    → Video Alarms`);
        if (infoId === 0x15) console.log(`    → Signal Loss Channels`);
        if (infoId === 0x16) console.log(`    → Signal Blocking Channels`);
        if (infoId === 0x17) console.log(`    → Memory Failures`);
        if (infoId === 0x18) console.log(`    → Abnormal Driving Behavior`);
        
        offset += 2 + infoLength;
      }
      
      if (offset === 28) {
        console.log(`  ⚠️  NO ADDITIONAL INFO FIELDS - Cameras not sending alert data`);
      }
    }
    
    // Parse location and alert data
    const alert = AlertParser.parseLocationReport(message.body, message.terminalPhone);
    
    if (alert) {
      this.processAlert(alert);
    }
    
    // Send location report response
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    
    socket.write(response);
  }

  private processAlert(alert: LocationAlert): void {
    // Check if there are any actual alerts
    const hasKnownBaseAlarmFlags = !!(alert.alarmFlags && (
      alert.alarmFlags.emergency ||
      alert.alarmFlags.overspeed ||
      alert.alarmFlags.fatigue ||
      alert.alarmFlags.dangerousDriving ||
      alert.alarmFlags.overspeedWarning ||
      alert.alarmFlags.fatigueWarning ||
      alert.alarmFlags.collisionWarning
    ));
    const hasAnyBaseAlarmBit = (alert.alarmFlagSetBits?.length || 0) > 0;
    const hasBaseAlarmFlags = hasKnownBaseAlarmFlags || hasAnyBaseAlarmBit;
    const hasKnownVideoAlarms = !!(alert.videoAlarms && Object.values(alert.videoAlarms).some(v => v === true));
    const hasAnyVideoAlarmBit = (alert.videoAlarms?.setBits?.length || 0) > 0;
    const hasVideoAlarms = hasKnownVideoAlarms || hasAnyVideoAlarmBit;
    const hasDrivingBehavior = alert.drivingBehavior && (alert.drivingBehavior.fatigue || alert.drivingBehavior.phoneCall || alert.drivingBehavior.smoking || alert.drivingBehavior.custom > 0);
    const hasSignalLoss = alert.signalLossChannels && alert.signalLossChannels.length > 0;
    const hasBlocking = alert.blockingChannels && alert.blockingChannels.length > 0;
    const hasMemoryFailures = alert.memoryFailures && (alert.memoryFailures.main.length > 0 || alert.memoryFailures.backup.length > 0);
    
    // Only log if there are actual alerts
    if (!hasBaseAlarmFlags && !hasVideoAlarms && !hasDrivingBehavior && !hasSignalLoss && !hasBlocking && !hasMemoryFailures) {
      return; // No alerts, skip logging
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`🚨🚨🚨 ALERT DETECTED 🚨🚨🚨`);
    console.log(`Vehicle: ${alert.vehicleId} | Time: ${alert.timestamp.toISOString()}`);
    console.log(`Location: ${alert.latitude}, ${alert.longitude}`);
    console.log('='.repeat(80));

    if (hasBaseAlarmFlags) {
      console.log('\n🚦 BASE ALARM FLAGS (0x0200 DWORD):', alert.alarmFlags);
    }
    
    if (hasVideoAlarms) {
      console.log('\n📹 VIDEO ALARMS:', alert.videoAlarms);
    }
    
    if (hasDrivingBehavior) {
      console.log('\n🚨 ABNORMAL DRIVING BEHAVIOR:');
      const behavior = alert.drivingBehavior!;
      
      if (behavior.fatigue) {
        console.log(`  😴 FATIGUE - Level: ${behavior.fatigueLevel}/100 ${behavior.fatigueLevel > 70 ? '⚠️ CRITICAL' : ''}`);
      }
      if (behavior.phoneCall) {
        console.log(`  📱 PHONE CALL DETECTED`);
      }
      if (behavior.smoking) {
        console.log(`  🚬 SMOKING DETECTED`);
      }
      if (behavior.custom > 0) {
        console.log(`  ⚠️  CUSTOM: ${behavior.custom}`);
      }
    }
    
    if (hasSignalLoss) {
      console.log(`\n📺 SIGNAL LOSS - Channels: ${alert.signalLossChannels!.join(', ')}`);
    }
    
    if (hasBlocking) {
      console.log(`🚫 SIGNAL BLOCKING - Channels: ${alert.blockingChannels!.join(', ')}`);
    }
    
    if (hasMemoryFailures) {
      if (alert.memoryFailures!.main.length) {
        console.log(`\n💾 MAIN MEMORY FAILURES: ${alert.memoryFailures!.main.join(', ')}`);
      }
      if (alert.memoryFailures!.backup.length) {
        console.log(`💾 BACKUP MEMORY FAILURES: ${alert.memoryFailures!.backup.join(', ')}`);
      }
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Don't save LocationAlert to database - it's converted to AlertEvent by AlertManager
    // this.alertStorage.saveAlert(alert);
    
    // Process through alert manager for escalation and screenshot capture
    this.alertManager.processAlert(alert);
  }

  private handleDisconnection(socket: net.Socket): void {
    const vehicleId = this.socketToVehicle.get(socket);
    if (vehicleId) {
      const vehicle = this.vehicles.get(vehicleId);
      if (vehicle) {
        vehicle.connected = false;
        vehicle.activeStreams.clear();
      }
      this.connections.delete(vehicleId);
      this.socketToVehicle.delete(socket);
    }
  }

  private parseCapabilities(body: Buffer, vehiclePhone: string): void {
    if (body.length < 10) {
      console.log(`⚠️ Capabilities body too short: ${body.length} bytes`);
      return;
    }
    
    // Parse according to Table 11 in spec
    const inputAudioEncoding = body.readUInt8(0);
    const inputAudioChannels = body.readUInt8(1);
    const inputAudioSampleRate = body.readUInt8(2);
    const inputAudioSampleBits = body.readUInt8(3);
    const audioFrameLength = body.readUInt16BE(4);
    const supportsAudioOutput = body.readUInt8(6) === 1;
    const videoEncoding = body.readUInt8(7);
    const maxAudioChannels = body.readUInt8(8);
    const maxVideoChannels = body.readUInt8(9);
    
    console.log(`
📊 Camera Capabilities for ${vehiclePhone}:`);
    console.log(`   Audio: encoding=${inputAudioEncoding}, channels=${inputAudioChannels}, rate=${inputAudioSampleRate}`);
    console.log(`   Video: encoding=${videoEncoding}, max channels=${maxVideoChannels}`);
    console.log(`   Max audio channels: ${maxAudioChannels}`);
    console.log(`   Max video channels: ${maxVideoChannels}`);
    
    const vehicle = this.vehicles.get(vehiclePhone);
    if (!vehicle) {
      console.log(`⚠️ Vehicle ${vehiclePhone} not found`);
      return;
    }
    
    // Create channel list based on max video channels
    const channels: VehicleChannel[] = [];
    for (let i = 1; i <= maxVideoChannels; i++) {
      channels.push({
        physicalChannel: i,
        logicalChannel: i,
        type: 'video',
        hasGimbal: false
      });
    }
    
    vehicle.channels = channels;
    console.log(`✅ Discovered ${channels.length} video channels`);
    
    // Auto-start video streaming on all channels to ensure circular buffer is always filled
    console.log(`\n🎬 Auto-starting video streams on all channels for alert capture...`);
    for (const channel of channels) {
      setTimeout(() => {
        console.log(`▶️ Starting stream on channel ${channel.logicalChannel}`);
        this.startVideo(vehiclePhone, channel.logicalChannel);
      }, 250 * channel.logicalChannel); // Stagger by 250ms (faster startup)
    }
  }

  private parseResourceList(body: Buffer): void {
    if (body.length < 2) {
      console.log(`⚠️ Resource list body too short: ${body.length} bytes`);
      return;
    }
    
    const itemCount = body.readUInt16BE(0);
    console.log(`💾 Found ${itemCount} video files`);
    console.log(`📦 Body length: ${body.length} bytes (expected: ${2 + itemCount * 28})`);
    
    if (body.length < 2 + itemCount * 28) {
      console.log(`⚠️ Incomplete response - camera may send in multiple packets`);
      
      return;
    }
    
    let offset = 2;
    for (let i = 0; i < itemCount && offset + 28 <= body.length; i++) {
      const channel = body.readUInt8(offset);
      const startTime = this.parseBcdTime(body.slice(offset + 1, offset + 7));
      const endTime = this.parseBcdTime(body.slice(offset + 7, offset + 13));
      const alarmType = body.readUInt8(offset + 13);
      const mediaType = body.readUInt8(offset + 14);
      const streamType = body.readUInt8(offset + 15);
      const storageType = body.readUInt8(offset + 16);
      const fileSize = body.readUInt32BE(offset + 17);
      
      console.log(`  📹 File ${i + 1}: Ch${channel} ${startTime} to ${endTime} (${fileSize} bytes, alarm:${alarmType})`);
      offset += 28;
    }
  }
  
  private parseBcdTime(buffer: Buffer): string {
    if (buffer.length < 6) return 'invalid';
    const year = this.fromBcd(buffer[0]) + 2000;
    const month = this.fromBcd(buffer[1]);
    const day = this.fromBcd(buffer[2]);
    const hour = this.fromBcd(buffer[3]);
    const minute = this.fromBcd(buffer[4]);
    const second = this.fromBcd(buffer[5]);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  }
  
  private fromBcd(byte: number): number {
    return ((byte >> 4) & 0x0F) * 10 + (byte & 0x0F);
  }

  queryCapabilities(vehicleId: string): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildQueryCapabilitiesCommand(
      vehicleId,
      this.getNextSerial()
    );
    
    
    socket.write(command);
    return true;
  }

  requestScreenshot(vehicleId: string, channel: number = 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const serverIp = socket.localAddress?.replace('::ffff:', '') || '0.0.0.0';
    const now = new Date();

    const command = ScreenshotCommands.buildSingleFrameRequest(
      vehicleId,
      this.getNextSerial(),
      serverIp,
      this.port,
      this.udpPort,
      channel,
      now
    );

    const legacyCommand = JTT1078Commands.buildPlaybackCommand(
      vehicleId,
      this.getNextSerial(),
      serverIp,
      this.port,
      channel,
      now,
      now,
      4
    );

    console.log(`Screenshot requested for vehicle ${vehicleId}, channel ${channel} (spec + legacy fallback)`);
    socket.write(command);
    setTimeout(() => {
      if (socket.writable) socket.write(legacyCommand);
    }, 120);
    return true;
  }

  async requestScreenshotWithFallback(
    vehicleId: string,
    channel: number = 1,
    options?: {
      fallback?: boolean;
      fallbackDelayMs?: number;
      alertId?: string;
      captureVideoEvidence?: boolean;
      videoDurationSec?: number;
    }
  ): Promise<{ success: boolean; fallback: ScreenshotFallbackResult }> {
    const fallbackEnabled = options?.fallback !== false;
    const fallbackDelayMs = Math.max(0, Math.min(3000, Number(options?.fallbackDelayMs) || 600));
    const captureVideoEvidence = options?.captureVideoEvidence === true;
    const videoDurationSec = Math.max(3, Math.min(20, Number(options?.videoDurationSec) || 8));
    const success = this.requestScreenshot(vehicleId, channel);

    if (!success) {
      return { success: false, fallback: { ok: false, reason: 'vehicle not connected' } };
    }

    if (!fallbackEnabled) {
      return { success: true, fallback: { ok: false, reason: 'disabled' } };
    }

    await new Promise((r) => setTimeout(r, fallbackDelayMs));
    const fallback = await this.captureScreenshotFromHLS(vehicleId, channel, options?.alertId);
    if (captureVideoEvidence) {
      const videoBackup = await this.captureVideoEvidenceFromHLS(vehicleId, channel, videoDurationSec, options?.alertId);
      if (videoBackup.ok && videoBackup.path) {
        fallback.videoEvidencePath = videoBackup.path;
      } else {
        fallback.videoEvidenceReason = videoBackup.reason;
      }
    }
    return { success: true, fallback };
  }

  private async captureVideoEvidenceFromHLS(
    vehicleId: string,
    channel: number,
    durationSec: number,
    alertId?: string
  ): Promise<{ ok: boolean; path?: string; reason?: string }> {
    try {
      const playlistPath = path.join(process.cwd(), 'hls', vehicleId, `channel_${channel}`, 'playlist.m3u8');
      if (!fs.existsSync(playlistPath)) {
        return { ok: false, reason: 'HLS playlist not found' };
      }

      const evidenceDir = path.join(process.cwd(), 'recordings', vehicleId, 'evidence');
      if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
      }

      const base = alertId ? `${alertId}_ch${channel}` : `screenshot_ch${channel}`;
      const outPath = path.join(evidenceDir, `${base}_${Date.now()}.mp4`);

      const ffmpegOk = await new Promise<boolean>((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
          '-hide_banner',
          '-loglevel', 'error',
          '-y',
          '-i', playlistPath,
          '-t', String(durationSec),
          '-c', 'copy',
          '-movflags', '+faststart',
          outPath
        ], { stdio: ['ignore', 'ignore', 'pipe'] });

        let stderr = '';
        const timeout = setTimeout(() => {
          ffmpeg.kill('SIGKILL');
          resolve(false);
        }, 12000);

        ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
        ffmpeg.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
        ffmpeg.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0 && fs.existsSync(outPath)) {
            resolve(true);
          } else {
            if (stderr) {
              console.warn(`Video evidence fallback ffmpeg stderr: ${stderr.slice(0, 300)}`);
            }
            resolve(false);
          }
        });
      });

      if (!ffmpegOk) {
        return { ok: false, reason: 'ffmpeg video capture failed' };
      }

      return { ok: true, path: outPath };
    } catch (error: any) {
      return { ok: false, reason: error?.message || 'video evidence fallback error' };
    }
  }

  private async captureScreenshotFromHLS(vehicleId: string, channel: number, alertId?: string): Promise<ScreenshotFallbackResult> {
    try {
      const playlistPath = path.join(process.cwd(), 'hls', vehicleId, `channel_${channel}`, 'playlist.m3u8');
      if (!fs.existsSync(playlistPath)) {
        console.log(`HLS fallback skipped: playlist not found for ${vehicleId} ch${channel}`);
        return { ok: false, reason: 'HLS playlist not found' };
      }

      const imageData = await new Promise<Buffer | null>((resolve) => {
        const ffmpeg = spawn('ffmpeg', [
          '-hide_banner',
          '-loglevel', 'error',
          '-i', playlistPath,
          '-frames:v', '1',
          '-f', 'image2pipe',
          '-vcodec', 'mjpeg',
          'pipe:1'
        ], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        const chunks: Buffer[] = [];
        let done = false;

        const finish = (data: Buffer | null) => {
          if (done) return;
          done = true;
          resolve(data);
        };

        const timeout = setTimeout(() => {
          ffmpeg.kill('SIGKILL');
          finish(null);
        }, 6000);

        ffmpeg.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
        ffmpeg.on('error', () => {
          clearTimeout(timeout);
          finish(null);
        });
        ffmpeg.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0 && chunks.length > 0) {
            finish(Buffer.concat(chunks));
          } else {
            finish(null);
          }
        });
      });

      if (!imageData || imageData.length < 4) {
        console.log(`HLS fallback capture failed for ${vehicleId} ch${channel}`);
        return { ok: false, reason: 'empty frame' };
      }

      const imageId = await this.imageStorage.saveImage(vehicleId, channel, imageData, alertId);
      console.log(`Alert ${alertId || 'manual'}: HLS fallback screenshot saved for ${vehicleId} ch${channel}`);
      return { ok: true, imageId };
    } catch (error: any) {
      console.error(`HLS fallback screenshot error for ${vehicleId} ch${channel}:`, error?.message || error);
      return { ok: false, reason: error?.message || 'fallback error' };
    }
  }

  requestCameraVideo(vehicleId: string, channel: number, startTime: Date, endTime: Date): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const serverIp = socket.localAddress?.replace('::ffff:', '') || '0.0.0.0';
    
    // Use JTT 1078-2016 compliant video request (0x9201)
    const commandBody = AlertVideoCommands.createAlertVideoRequest(
      vehicleId,
      channel,
      startTime,
      endTime,
      serverIp,
      this.port
    );
    
    const command = this.buildMessage(0x9201, vehicleId, this.getNextSerial(), commandBody);
    
    console.log(`🎥 Camera video requested: ${vehicleId} ch${channel} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    socket.write(command);
    return true;
  }

  requestCameraVideoDownload(vehicleId: string, channel: number, startTime: Date, endTime: Date): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const ftpHost = process.env.ALERT_VIDEO_FTP_HOST || process.env.FTP_HOST || '';
    const ftpPort = Number(process.env.ALERT_VIDEO_FTP_PORT || process.env.FTP_PORT || 21);
    const ftpUser = process.env.ALERT_VIDEO_FTP_USER || process.env.FTP_USER || '';
    const ftpPass = process.env.ALERT_VIDEO_FTP_PASS || process.env.FTP_PASS || '';
    const ftpPath = process.env.ALERT_VIDEO_FTP_PATH || process.env.FTP_PATH || '/';

    if (!ftpHost || !ftpUser) {
      console.warn(`FTP config missing; skip 0x9206 download for ${vehicleId} ch${channel}`);
      return false;
    }

    const command = JTT1078Commands.buildFileUploadCommand(
      vehicleId,
      this.getNextSerial(),
      ftpHost,
      ftpPort,
      ftpUser,
      ftpPass,
      ftpPath,
      channel,
      startTime,
      endTime,
      {
        resourceType: 2,
        streamType: 1,
        storageLocation: 1,
        taskExecutionConditions: 0b010
      }
    );
    
    console.log(`Camera FTP upload requested: ${vehicleId} ch${channel} from ${startTime.toISOString()} to ${endTime.toISOString()} -> ftp://${ftpHost}:${ftpPort}${ftpPath}`);
    socket.write(command);
    return true;
  }

  queryResourceList(vehicleId: string, channel: number, startTime: Date, endTime: Date): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildQueryResourceListCommand(
      vehicleId,
      this.getNextSerial(),
      channel,
      startTime,
      endTime
    );
    
    console.log(`📝 Query resource list: ${vehicleId} ch${channel} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    socket.write(command);
    return true;
  }

  // Public methods for video control
  startVideo(vehicleId: string, channel: number = 1): boolean {
    console.log(`🎬 startVideo called: vehicleId=${vehicleId}, channel=${channel}`);
    
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      console.log(`  ❌ Cannot start video: vehicle=${!!vehicle}, socket=${!!socket}, connected=${vehicle?.connected}`);
      return false;
    }

    // Initialize circular buffer for this channel
    this.alertManager.initializeBuffer(vehicleId, channel);

    const serverIp = process.env.SERVER_IP || socket.localAddress?.replace('::ffff:', '') || '0.0.0.0';
    
    const command = JTT1078Commands.buildStartVideoCommand(
      vehicleId,
      this.getNextSerial(),
      serverIp,
      this.port,      // TCP port for signaling
      this.udpPort,   // UDP port for RTP video stream
      channel,
      1,              // 1 = Video only
      1               // 1 = Sub stream (lower bitrate, faster)
    );
    
    console.log(`📡 Sending 0x9101: ServerIP=${serverIp}, TCP=${this.port}, UDP=${this.udpPort}, Channel=${channel}`);
    socket.write(command);
    vehicle.activeStreams.add(channel);
    
    return true;
  }

  optimizeVideoParameters(vehicleId: string, channel: number = 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildSetVideoParametersCommand(
      vehicleId,
      this.getNextSerial(),
      channel,
      1,    // CIF (352x288)
      15,   // 15 fps
      512   // 512 kbps
    );
    
    console.log(`⚡ Optimizing camera: ${vehicleId} ch${channel} -> CIF/15fps/512kbps`);
    socket.write(command);
    return true;
  }

  switchStream(vehicleId: string, channel: number, streamType: 0 | 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildStreamControlCommand(
      vehicleId,
      this.getNextSerial(),
      channel,
      1, // Switch stream
      0,
      streamType
    );
    
    console.log(`🔄 Switching to ${streamType === 0 ? 'MAIN' : 'SUB'} stream: ${vehicleId} channel ${channel}`);
    socket.write(command);
    return true;
  }

  stopVideo(vehicleId: string, channel: number = 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return false;
    
    vehicle.activeStreams.delete(channel);
    
    return true;
  }

  getVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.get(id);
  }

  async getAlerts() {
    return await this.alertStorage.getActiveAlerts();
  }

  async getDevices() {
    return await this.deviceStorage.getDevices();
  }

  private handleMultimediaEvent(message: any, socket: net.Socket): void {
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private handleCustomMessage(message: any, socket: net.Socket): void {
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private async handleMultimediaData(message: any, socket: net.Socket): Promise<void> {
    try {
      const multimedia = MultimediaParser.parseMultimediaData(message.body, message.terminalPhone);
      
      if (multimedia && multimedia.type === 'jpeg') {
        // Save image to Supabase and database (with error handling)
        await this.imageStorage.saveImage(message.terminalPhone, multimedia.channel, multimedia.data).catch(err => {
          console.error(`Failed to save image: ${err.message}`);
        });
        
        console.log(`📷 Saved image from ${message.terminalPhone} channel ${multimedia.channel}`);
      }
    } catch (error) {
      console.error('Error handling multimedia data:', error);
    }
    
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }
}








