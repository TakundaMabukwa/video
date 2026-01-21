import * as net from 'net';
import { JTT808Parser } from './parser';
import { JTT1078Commands } from './commands';
import { AlertParser } from './alertParser';
import { MultimediaParser } from './multimediaParser';
import { AlertVideoCommands } from './alertVideoCommands';
import { AlertStorageDB } from '../storage/alertStorageDB';
import { DeviceStorage } from '../storage/deviceStorage';
import { ImageStorage } from '../storage/imageStorage';
import { AlertManager } from '../alerts/alertManager';
import { JTT808MessageType, Vehicle, LocationAlert, VehicleChannel } from '../types/jtt';

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
      console.log(`📸 Alert ${alertId}: Requesting screenshot from ${vehicleId} channel ${channel}`);
      this.requestScreenshot(vehicleId, channel);
    });
    
    // Listen for camera video requests from alert manager
    this.alertManager.on('request-camera-video', ({ vehicleId, channel, startTime, endTime, alertId }) => {
      console.log(`🎥 Alert ${alertId}: Requesting camera SD card video from ${vehicleId} channel ${channel}`);
      this.requestCameraVideo(vehicleId, channel, startTime, endTime);
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
      
      // Process complete messages
      while (buffer.length > 0) {
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
        
        // Check for JT/T 808 message (0x7E)
        const messageEnd = buffer.indexOf(0x7E, 1);
        if (messageEnd === -1) break;
        
        const messageBuffer = buffer.slice(0, messageEnd + 1);
        buffer = buffer.slice(messageEnd + 1);
        
        await this.processMessage(messageBuffer, socket);
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
      case 0x0800: // Multimedia event message upload
        this.handleMultimediaEvent(message, socket);
        break;
      case 0x0801: // Multimedia data upload
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
    
    // Auto-start video streaming on all channels
    console.log(`\n🎬 Auto-starting video streams on all channels...`);
    for (const channel of channels) {
      setTimeout(() => {
        console.log(`▶️ Starting stream on channel ${channel.logicalChannel}`);
        this.startVideo(vehiclePhone, channel.logicalChannel);
      }, 500 * channel.logicalChannel); // Stagger by 500ms
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

    const command = JTT1078Commands.buildPlaybackCommand(
      vehicleId,
      this.getNextSerial(),
      serverIp,
      this.port,
      channel,
      now,
      now,
      4 // Single frame upload
    );
    
    console.log(`📸 Screenshot requested for vehicle ${vehicleId}, channel ${channel} (TCP ${this.port})`);
    socket.write(command);
    return true;
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
      0               // 0 = Main stream
    );
    
    console.log(`📡 Sending 0x9101: ServerIP=${serverIp}, TCP=${this.port}, UDP=${this.udpPort}, Channel=${channel}`);
    socket.write(command);
    vehicle.activeStreams.add(channel);
    
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





