import * as net from 'net';
import { JTT808Parser } from './parser';
import { JTT1078Commands } from './commands';
import { AlertParser } from './alertParser';
import { MultimediaParser } from './multimediaParser';
import { AlertStorage } from '../storage/alertStorage';
import { DeviceLogger } from '../logging/deviceLogger';
import { JTT808MessageType, Vehicle, LocationAlert, VehicleChannel } from '../types/jtt';

export class JTT808Server {
  private server: net.Server;
  private vehicles = new Map<string, Vehicle>();
  private connections = new Map<string, net.Socket>();
  private serialCounter = 1;
  private rtpHandler?: (buffer: Buffer, vehicleId: string) => void;
  private alertStorage = new AlertStorage();
  private deviceLogger = new DeviceLogger();

  constructor(private port: number, private udpPort: number) {
    this.server = net.createServer(this.handleConnection.bind(this));
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
    console.log(`New TCP connection from ${socket.remoteAddress}:${socket.remotePort}`);
    
    let buffer = Buffer.alloc(0);
    
    socket.on('data', (data) => {
      console.log(`Received ${data.length} bytes from ${socket.remoteAddress}`);
      buffer = Buffer.concat([buffer, data]);
      
      // Process complete messages
      while (buffer.length > 0) {
        // Check for RTP video data first (0x30316364)
        if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x30316364) {
          // Find RTP packet length from header
          if (buffer.length >= 20) {
            const payloadLength = buffer.readUInt16BE(18);
            const totalLength = 20 + payloadLength;
            
            if (buffer.length >= totalLength) {
              const rtpPacket = buffer.slice(0, totalLength);
              buffer = buffer.slice(totalLength);
              this.handleRTPData(rtpPacket, socket);
              continue;
            }
          }
          break; // Wait for more data
        }
        
        // Check for JT/T 808 message (0x7E)
        const messageEnd = buffer.indexOf(0x7E, 1);
        if (messageEnd === -1) break;
        
        const messageBuffer = buffer.slice(0, messageEnd + 1);
        buffer = buffer.slice(messageEnd + 1);
        
        this.processMessage(messageBuffer, socket);
      }
    });

    socket.on('close', () => {
      console.log(`TCP connection closed: ${socket.remoteAddress}:${socket.remotePort}`);
      this.handleDisconnection(socket);
    });

    socket.on('error', (error) => {
      console.error(`TCP socket error:`, error);
    });
  }

  private processMessage(buffer: Buffer, socket: net.Socket): void {
    const message = JTT808Parser.parseMessage(buffer);
    if (!message) {
      console.warn('Failed to parse JT/T 808 message');
      return;
    }

    console.log(`Received message 0x${message.messageId.toString(16)} from ${message.terminalPhone}`);

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
        console.log(`Terminal response 0x1, body: ${message.body.toString('hex')}`);
        break;
      case 0x1003: // Audio/video capabilities response
        console.log(`Camera capabilities (0x1003): ${message.body.toString('hex')}`);
        this.parseCapabilities(message.body);
        break;
      case 0x0800: // Multimedia event message upload
        this.handleMultimediaEvent(message, socket);
        break;
      case 0x0801: // Multimedia data upload
        this.handleMultimediaData(message, socket);
        break;
      case 0x0704: // Custom/proprietary message
        this.handleCustomMessage(message, socket);
        break;
      default:
        console.log(`Unhandled message type: 0x${message.messageId.toString(16)}`);
    }
  }

  private handleRTPData(buffer: Buffer, socket: net.Socket): void {
    let vehicleId = 'unknown';
    for (const [phone, conn] of this.connections.entries()) {
      if (conn === socket) {
        vehicleId = phone;
        break;
      }
    }
    
    if (this.rtpHandler) {
      this.rtpHandler(buffer, vehicleId);
    }
  }

  private handleTerminalRegister(message: any, socket: net.Socket): void {
    const ipAddress = socket.remoteAddress || 'unknown';
    this.deviceLogger.logDevice(message.terminalPhone, message.terminalPhone, ipAddress);
    
    const vehicle: Vehicle = {
      id: message.terminalPhone,
      phone: message.terminalPhone,
      connected: true,
      lastHeartbeat: new Date(),
      activeStreams: new Set()
    };
    
    this.vehicles.set(message.terminalPhone, vehicle);
    this.connections.set(message.terminalPhone, socket);
    
    // Send proper 0x8100 registration response with auth token
    const authToken = Buffer.from('AUTH123456', 'ascii');
    const responseBody = Buffer.alloc(3 + authToken.length);
    responseBody.writeUInt16BE(message.serialNumber, 0);
    responseBody.writeUInt8(0, 2); // Success
    authToken.copy(responseBody, 3);
    
    const response = this.buildMessage(0x8100, message.terminalPhone, this.serialCounter++, responseBody);
    
    console.log(`Sending 0x8100 response with auth token: ${authToken.toString('hex')}`);
    socket.write(response);
    console.log(`Vehicle ${message.terminalPhone} registered with auth token`);
    
    // Keep connection alive
    socket.setKeepAlive(true, 30000);
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
    const ipAddress = socket.remoteAddress || 'unknown';
    
    // If vehicle doesn't exist, create it (camera skipped registration)
    if (!this.vehicles.has(message.terminalPhone)) {
      this.deviceLogger.logDevice(message.terminalPhone, message.terminalPhone, ipAddress);
      
      const vehicle: Vehicle = {
        id: message.terminalPhone,
        phone: message.terminalPhone,
        connected: true,
        lastHeartbeat: new Date(),
        activeStreams: new Set()
      };
      this.vehicles.set(message.terminalPhone, vehicle);
      this.connections.set(message.terminalPhone, socket);
      console.log(`Vehicle ${message.terminalPhone} added via auth`);
    }
    
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.serialCounter++,
      message.serialNumber,
      message.messageId,
      0
    );
    
    socket.write(response);
    console.log(`Vehicle ${message.terminalPhone} authenticated`);
  }

  private handleHeartbeat(message: any, socket: net.Socket): void {
    const vehicle = this.vehicles.get(message.terminalPhone);
    if (vehicle) {
      vehicle.lastHeartbeat = new Date();
    }
    
    // Send heartbeat response
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.serialCounter++,
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
      this.serialCounter++,
      message.serialNumber,
      message.messageId,
      0
    );
    
    socket.write(response);
  }

  private processAlert(alert: LocationAlert): void {
    // Check if there are any actual alerts
    const hasVideoAlarms = alert.videoAlarms && Object.values(alert.videoAlarms).some(v => v === true);
    const hasDrivingBehavior = alert.drivingBehavior && (alert.drivingBehavior.fatigue || alert.drivingBehavior.phoneCall || alert.drivingBehavior.smoking || alert.drivingBehavior.custom > 0);
    const hasSignalLoss = alert.signalLossChannels && alert.signalLossChannels.length > 0;
    const hasBlocking = alert.blockingChannels && alert.blockingChannels.length > 0;
    const hasMemoryFailures = alert.memoryFailures && (alert.memoryFailures.main.length > 0 || alert.memoryFailures.backup.length > 0);
    
    // Only log if there are actual alerts
    if (!hasVideoAlarms && !hasDrivingBehavior && !hasSignalLoss && !hasBlocking && !hasMemoryFailures) {
      return; // No alerts, skip logging
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`🚨🚨🚨 ALERT DETECTED 🚨🚨🚨`);
    console.log(`Vehicle: ${alert.vehicleId} | Time: ${alert.timestamp.toISOString()}`);
    console.log(`Location: ${alert.latitude}, ${alert.longitude}`);
    console.log('='.repeat(80));
    
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
    
    // Save alert to JSON database
    this.alertStorage.saveAlert(alert);
  }

  private handleDisconnection(socket: net.Socket): void {
    for (const [phone, conn] of this.connections.entries()) {
      if (conn === socket) {
        const vehicle = this.vehicles.get(phone);
        if (vehicle) {
          vehicle.connected = false;
          vehicle.activeStreams.clear();
        }
        this.connections.delete(phone);
        break;
      }
    }
  }

  private parseCapabilities(body: Buffer): void {
    if (body.length < 2) return;
    
    const channelCount = body.readUInt8(0);
    console.log(`Camera has ${channelCount} channels`);
    
    const channels: VehicleChannel[] = [];
    let offset = 1;
    
    for (let i = 0; i < channelCount && offset + 2 < body.length; i++) {
      const physicalChannel = body.readUInt8(offset);
      const logicalChannel = body.readUInt8(offset + 1);
      const channelType = body.readUInt8(offset + 2);
      const hasGimbal = offset + 3 < body.length ? body.readUInt8(offset + 3) === 1 : false;
      
      const typeMap = { 0: 'audio_video', 1: 'audio', 2: 'video' } as const;
      
      channels.push({
        physicalChannel,
        logicalChannel,
        type: typeMap[channelType as keyof typeof typeMap] || 'video',
        hasGimbal
      });
      
      console.log(`Channel ${physicalChannel}: Logical=${logicalChannel}, Type=${typeMap[channelType as keyof typeof typeMap]}, Gimbal=${hasGimbal}`);
      offset += 4;
    }
    
    // Store channels in vehicle data
    const phoneFromBody = this.extractPhoneFromContext();
    if (phoneFromBody) {
      const vehicle = this.vehicles.get(phoneFromBody);
      if (vehicle) {
        vehicle.channels = channels;
      }
    }
  }
  
  private extractPhoneFromContext(): string | null {
    // This would need to be passed from the message context
    // For now, return the most recently connected vehicle
    const connectedVehicles = Array.from(this.vehicles.values()).filter(v => v.connected);
    return connectedVehicles.length > 0 ? connectedVehicles[connectedVehicles.length - 1].phone : null;
  }

  queryCapabilities(vehicleId: string): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildQueryCapabilitiesCommand(
      vehicleId,
      this.serialCounter++
    );
    
    console.log(`Sending 0x9003 query capabilities to ${vehicleId}`);
    socket.write(command);
    return true;
  }

  requestScreenshot(vehicleId: string, channel: number = 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildScreenshotCommand(
      vehicleId,
      this.serialCounter++,
      channel
    );
    
    console.log(`📸 Screenshot requested for vehicle ${vehicleId}, channel ${channel}`);
    socket.write(command);
    return true;
  }

  // Public methods for video control
  startVideo(vehicleId: string, channel: number = 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const serverIp = socket.localAddress?.replace('::ffff:', '') || '0.0.0.0';
    
    const command = JTT1078Commands.buildStartVideoCommand(
      vehicleId,
      this.serialCounter++,
      serverIp,
      this.udpPort,
      channel,
      1, // Video only
      0  // Main stream
    );
    
    console.log(`Sending 0x9101: IP=${serverIp}, Port=${this.udpPort}, Channel=${channel}`);
    socket.write(command);
    vehicle.activeStreams.add(channel);
    
    console.log(`Started video stream for vehicle ${vehicleId}, channel ${channel}`);
    return true;
  }

  stopVideo(vehicleId: string, channel: number = 1): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return false;
    
    vehicle.activeStreams.delete(channel);
    console.log(`Stopped video stream for vehicle ${vehicleId}, channel ${channel}`);
    return true;
  }

  getVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.get(id);
  }

  getAlerts(): LocationAlert[] {
    return this.alertStorage.getAlerts();
  }

  getDevices(): any[] {
    return this.deviceLogger.getDevices();
  }

  private handleMultimediaEvent(message: any, socket: net.Socket): void {
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.serialCounter++,
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private handleCustomMessage(message: any, socket: net.Socket): void {
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.serialCounter++,
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private handleMultimediaData(message: any, socket: net.Socket): void {
    const multimedia = MultimediaParser.parseMultimediaData(message.body, message.terminalPhone);
    
    if (multimedia) {
      const filePath = MultimediaParser.saveMultimediaFile(
        message.terminalPhone,
        multimedia.filename,
        multimedia.data
      );
      
      console.log(`📷 Saved ${multimedia.type} from ${message.terminalPhone}: ${multimedia.filename}`);
    }
    
    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.serialCounter++,
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }
}