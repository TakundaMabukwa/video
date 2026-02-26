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
import { AlertManager, AlertPriority } from '../alerts/alertManager';
import { JTT808MessageType, Vehicle, LocationAlert, VehicleChannel } from '../types/jtt';

type ScreenshotFallbackResult = {
  ok: boolean;
  imageId?: string;
  reason?: string;
  videoEvidencePath?: string;
  videoEvidenceReason?: string;
};

type ResourceVideoItem = {
  channel: number;
  startTime: string;
  endTime: string;
  alarmFlag64Hex: string;
  alarmBits: number[];
  alarmLabels: string[];
  alarmType: number;
  mediaType: number;
  streamType: number;
  storageType: number;
  fileSize: number;
};

type PendingResourceList = {
  createdAt: number;
  packetCount: number;
  parts: Map<number, Buffer>;
};

type MessageTraceEntry = {
  id: number;
  receivedAt: string;
  vehicleId: string;
  messageId: number;
  messageIdHex: string;
  serialNumber: number;
  bodyLength: number;
  isSubpackage: boolean;
  packetCount?: number;
  packetIndex?: number;
  rawFrameHex: string;
  bodyHex: string;
  bodyTextPreview: string;
  parse?: Record<string, unknown>;
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
  private latestResourceLists = new Map<string, { receivedAt: number; items: ResourceVideoItem[] }>();
  private pendingResourceLists = new Map<string, PendingResourceList>();
  private lastKnownLocation = new Map<string, { latitude: number; longitude: number; timestamp: Date }>();
  private messageTraceSeq = 0;
  private recentMessageTraces: MessageTraceEntry[] = [];
  private readonly maxMessageTraceBuffer = Math.max(
    50,
    Number(process.env.MESSAGE_TRACE_BUFFER_SIZE || 300)
  );

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
        this.handleLocationReport(message, socket, buffer);
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

        if (message.isSubpackage && message.packetCount && message.packetIndex) {
          this.handleResourceListSubpackage(
            message.terminalPhone,
            message.body,
            message.packetCount,
            message.packetIndex
          );
        } else {
          this.parseResourceList(message.terminalPhone, message.body);
        }
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
      case 0x0704: // JT/T 808 location batch upload
        this.handleLocationBatchUpload(message, socket, buffer);
        break;
      case 0x0900: // JT/T 808 data uplink pass-through
        this.handleDataUplinkPassThrough(message, socket, buffer);
        break;
      default:
        this.handleUnknownMessage(message, socket, buffer);
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

      const autoConfigureMask = String(process.env.AUTO_CONFIGURE_VIDEO_ALARM_MASK ?? 'true').toLowerCase() !== 'false';
      if (autoConfigureMask) {
        const configuredMask = Number(process.env.VIDEO_ALARM_MASK_WORD ?? 0) >>> 0;
        setTimeout(() => {
          const ok = this.setVideoAlarmMask(message.terminalPhone, configuredMask);
          if (ok) {
            console.log(`Set video alarm mask (0x007A)=0x${configuredMask.toString(16).padStart(8, '0')} for ${message.terminalPhone}`);
          }
        }, 1500);
      }
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

  private handleLocationReport(message: any, socket: net.Socket, rawFrame?: Buffer): void {
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
    const additionalInfo = this.extractLocationAdditionalInfoFields(message.body);
    
    if (alert) {
      this.lastKnownLocation.set(alert.vehicleId, {
        latitude: alert.latitude,
        longitude: alert.longitude,
        timestamp: alert.timestamp
      });

      const vendorMapped = this.detectVendorAlarmFromLocationBody(message.body);
      if (vendorMapped) {
        void this.alertManager.processExternalAlert({
          vehicleId: alert.vehicleId,
          channel: vendorMapped.channel || this.inferLocationAlertChannel(alert),
          type: vendorMapped.type,
          signalCode: vendorMapped.signalCode,
          priority: vendorMapped.priority,
          timestamp: alert.timestamp,
          location: { latitude: alert.latitude, longitude: alert.longitude },
          metadata: {
            sourceMessageId: '0x0200',
            vendorCodeMapped: true,
            alarmCode: vendorMapped.alarmCode ?? null,
            locationAdditionalInfoId: vendorMapped.infoId ?? null
          }
        });
      } else {
        this.processAlert(alert);
      }
    }

    this.pushMessageTrace(message, rawFrame, {
      parser: 'location-report-0x0200',
      parseSuccess: !!alert,
      additionalInfo,
      parsedAlert: alert
        ? {
            timestamp: alert.timestamp?.toISOString?.() || null,
            latitude: alert.latitude,
            longitude: alert.longitude,
            speed: alert.speed,
            direction: alert.direction,
            altitude: alert.altitude,
            rawAlarmFlagHex: typeof alert.rawAlarmFlag === 'number'
              ? `0x${alert.rawAlarmFlag.toString(16).padStart(8, '0')}`
              : null,
            rawStatusFlagHex: typeof alert.rawStatusFlag === 'number'
              ? `0x${alert.rawStatusFlag.toString(16).padStart(8, '0')}`
              : null,
            baseAlarmSetBits: alert.alarmFlagSetBits || [],
            alarmFlags: alert.alarmFlags || null,
            videoAlarms: alert.videoAlarms || null,
            signalLossChannels: alert.signalLossChannels || [],
            blockingChannels: alert.blockingChannels || [],
            memoryFailures: alert.memoryFailures || null,
            drivingBehavior: alert.drivingBehavior || null
          }
        : null
    });
    
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

  private handleLocationBatchUpload(message: any, socket: net.Socket, rawFrame?: Buffer): void {
    const body: Buffer = message.body;
    if (body.length < 3) {
      this.pushMessageTrace(message, rawFrame, {
        parser: 'location-batch-0x0704',
        parseSuccess: false,
        error: 'Body too short for batch upload'
      });
      const response = JTT1078Commands.buildGeneralResponse(
        message.terminalPhone,
        this.getNextSerial(),
        message.serialNumber,
        message.messageId,
        2 // message error
      );
      socket.write(response);
      return;
    }

    const declaredCount = body.readUInt16BE(0);
    const uploadType = body.readUInt8(2); // 0 normal, 1 blind-area补传 (terminal dependent)
    let offset = 3;
    let parsed = 0;
    let processedAlerts = 0;
    const itemDiagnostics: Array<Record<string, unknown>> = [];

    while (offset + 2 <= body.length) {
      const itemLen = body.readUInt16BE(offset);
      offset += 2;
      if (itemLen <= 0 || offset + itemLen > body.length) {
        break;
      }

      const itemBody = body.slice(offset, offset + itemLen);
      offset += itemLen;
      parsed++;

      const alert = AlertParser.parseLocationReport(itemBody, message.terminalPhone);
      if (itemDiagnostics.length < 20) {
        itemDiagnostics.push({
          index: parsed,
          length: itemLen,
          parseSuccess: !!alert,
          bodyHex: itemBody.toString('hex').slice(0, 1024),
          additionalInfo: this.extractLocationAdditionalInfoFields(itemBody),
          parsedAlert: alert
            ? {
                timestamp: alert.timestamp?.toISOString?.() || null,
                latitude: alert.latitude,
                longitude: alert.longitude,
                rawAlarmFlagHex: typeof alert.rawAlarmFlag === 'number'
                  ? `0x${alert.rawAlarmFlag.toString(16).padStart(8, '0')}`
                  : null,
                rawStatusFlagHex: typeof alert.rawStatusFlag === 'number'
                  ? `0x${alert.rawStatusFlag.toString(16).padStart(8, '0')}`
                  : null,
                baseAlarmSetBits: alert.alarmFlagSetBits || [],
                alarmFlags: alert.alarmFlags || null,
                videoAlarms: alert.videoAlarms || null,
                signalLossChannels: alert.signalLossChannels || [],
                blockingChannels: alert.blockingChannels || [],
                memoryFailures: alert.memoryFailures || null,
                drivingBehavior: alert.drivingBehavior || null
              }
            : null
        });
      }
      if (!alert) {
        continue;
      }

      this.lastKnownLocation.set(alert.vehicleId, {
        latitude: alert.latitude,
        longitude: alert.longitude,
        timestamp: alert.timestamp
      });

      const hadBefore = this.alertManager.getAlertStats().total;
      const vendorMapped = this.detectVendorAlarmFromLocationBody(itemBody);
      if (vendorMapped) {
        void this.alertManager.processExternalAlert({
          vehicleId: alert.vehicleId,
          channel: vendorMapped.channel || this.inferLocationAlertChannel(alert),
          type: vendorMapped.type,
          signalCode: vendorMapped.signalCode,
          priority: vendorMapped.priority,
          timestamp: alert.timestamp,
          location: { latitude: alert.latitude, longitude: alert.longitude },
          metadata: {
            sourceMessageId: '0x0704',
            vendorCodeMapped: true,
            alarmCode: vendorMapped.alarmCode ?? null,
            locationAdditionalInfoId: vendorMapped.infoId ?? null
          }
        });
      } else {
        this.processAlert(alert);
      }
      const hadAfter = this.alertManager.getAlertStats().total;
      if (hadAfter > hadBefore) {
        processedAlerts += hadAfter - hadBefore;
      }
    }

    console.log(`Location batch 0x0704 from ${message.terminalPhone}: declared=${declaredCount}, parsed=${parsed}, uploadType=${uploadType}, alerts=${processedAlerts}`);
    this.pushMessageTrace(message, rawFrame, {
      parser: 'location-batch-0x0704',
      parseSuccess: true,
      declaredCount,
      parsedItems: parsed,
      uploadType,
      processedAlerts,
      itemDiagnostics
    });

    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private handleDataUplinkPassThrough(message: any, socket: net.Socket, rawFrame?: Buffer): void {
    const body: Buffer = message.body || Buffer.alloc(0);
    const passThroughType = body.length > 0 ? body.readUInt8(0) : -1;
    const payload = body.length > 1 ? body.slice(1) : Buffer.alloc(0);
    const decoded = this.decodeCustomPayloadText(payload) || '';
    const preview = this.buildPayloadPreview(payload, 320);
    const combinedText = `${decoded} ${preview}`.trim();
    const alarmParsingEnabled = this.isAlarmPassThroughType(passThroughType);
    const parsed = this.extractPassThroughAlarm(
      passThroughType,
      payload,
      combinedText,
      alarmParsingEnabled
    );
    const last = this.lastKnownLocation.get(message.terminalPhone);

    if (parsed) {
      void this.alertManager.processExternalAlert({
        vehicleId: message.terminalPhone,
        channel: parsed.channel || 1,
        type: parsed.type,
        signalCode: parsed.signalCode,
        priority: parsed.priority,
        timestamp: new Date(),
        location: last ? { latitude: last.latitude, longitude: last.longitude } : undefined,
        metadata: {
          sourceMessageId: '0x0900',
          passThroughType,
          passThroughTypeHex: `0x${Math.max(passThroughType, 0).toString(16).padStart(2, '0')}`,
          alarmCode: parsed.alarmCode ?? null,
          decodedText: decoded || null,
          payloadPreview: preview,
          rawPayloadHex: payload.toString('hex').slice(0, 1024)
        }
      });
    }

    this.pushMessageTrace(message, rawFrame, {
      parser: 'data-uplink-pass-through-0x0900',
      passThroughType,
      passThroughTypeHex: `0x${Math.max(passThroughType, 0).toString(16).padStart(2, '0')}`,
      alarmParsingEnabled,
      payloadPreview: preview,
      decodedText: decoded || null,
      parsedAlert: parsed
        ? {
            type: parsed.type,
            signalCode: parsed.signalCode,
            priority: parsed.priority,
            alarmCode: parsed.alarmCode ?? null,
            channel: parsed.channel || 1
          }
        : null
    });

    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private handleUnknownMessage(message: any, socket: net.Socket, rawFrame?: Buffer): void {
    const mapped = this.detectVendorAlarmFromPayload(message.body || Buffer.alloc(0));
    const sourceMessageId = `0x${Number(message.messageId || 0).toString(16).padStart(4, '0')}`;
    const last = this.lastKnownLocation.get(message.terminalPhone);

    if (mapped) {
      void this.alertManager.processExternalAlert({
        vehicleId: message.terminalPhone,
        channel: mapped.channel || 1,
        type: mapped.type,
        signalCode: mapped.signalCode,
        priority: mapped.priority,
        timestamp: new Date(),
        location: last ? { latitude: last.latitude, longitude: last.longitude } : undefined,
        metadata: {
          sourceMessageId,
          alarmCode: mapped.alarmCode ?? null,
          parser: 'unknown-message-vendor-map'
        }
      });
    }

    this.pushMessageTrace(message, rawFrame, {
      parser: 'unknown-message',
      mappedAlert: mapped || null
    });

    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private isAlarmPassThroughType(passThroughType: number): boolean {
    if (!Number.isFinite(passThroughType) || passThroughType < 0 || passThroughType > 0xFF) {
      return false;
    }
    // JT/T 808 Table 93: serial pass-through (0x41/0x42) and user-defined (0xF0~0xFF)
    // are the only types likely to carry proprietary ADAS/DMS alarm payloads.
    if (passThroughType === 0x41 || passThroughType === 0x42) return true;
    if (passThroughType >= 0xF0 && passThroughType <= 0xFF) return true;

    const extraRaw = String(process.env.ALARM_PASS_THROUGH_TYPES ?? '').trim();
    if (!extraRaw) return false;
    const extraTypes = extraRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase().startsWith('0x') ? parseInt(s, 16) : parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 0xFF);
    return extraTypes.includes(passThroughType);
  }

  private extractPassThroughAlarm(
    passThroughType: number,
    payload: Buffer,
    text: string,
    allowHeuristicBinaryDecode: boolean
  ): { type: string; priority: AlertPriority; signalCode: string; channel?: number; alarmCode?: number } | null {
    const channelMatch = text.match(/\bch(?:annel)?\s*[:#-]?\s*(\d{1,2})\b/i);
    const channel = channelMatch ? Number(channelMatch[1]) : undefined;

    // 1) Pattern-first matching (basis list from ADAS/DMS/behavior alert catalog).
    // Matches explicit text labels before any code heuristics.
    const mappedByText = this.mapVendorAlarmText(text);
    if (mappedByText) {
      return { ...mappedByText, channel };
    }

    // Always attempt explicit documented code extraction from text preview.
    // This is deterministic and does not rely on payload-type assumptions.
    const codeFromText = this.extractAlarmCodeFromText(text);
    if (codeFromText !== null) {
      const mapped = this.mapVendorAlarmCode(codeFromText, { allowPlatformVideoCodes: true });
      if (mapped) {
        return { ...mapped, channel, alarmCode: codeFromText };
      }
    }

    // Deterministic fallback: some terminals place the alarm code in the first WORD
    // but use a pass-through type outside the documented alarm-carrying values.
    // We only accept it if it maps to a known documented code.
    if (payload.length >= 2) {
      const firstBe = payload.readUInt16BE(0);
      const mappedBe = this.mapVendorAlarmCode(firstBe, { allowPlatformVideoCodes: true });
      if (mappedBe) return { ...mappedBe, channel, alarmCode: firstBe };

      const firstLe = payload.readUInt16LE(0);
      const mappedLe = this.mapVendorAlarmCode(firstLe, { allowPlatformVideoCodes: true });
      if (mappedLe) return { ...mappedLe, channel, alarmCode: firstLe };
    }

    // Heuristic binary decode is only attempted for pass-through types aligned to alarm payloads.
    if (!allowHeuristicBinaryDecode) {
      return null;
    }

    // Binary scan is intentionally opt-in; without vendor payload framing spec it can create false positives.
    const allowBinaryScan = String(process.env.PASS_THROUGH_BINARY_SCAN_ENABLED ?? 'false').toLowerCase() === 'true';
    if (allowBinaryScan && payload.length >= 2) {
      for (let i = 0; i <= payload.length - 2; i++) {
        const be = payload.readUInt16BE(i);
        const mappedBe = this.mapVendorAlarmCode(be, { allowPlatformVideoCodes: true });
        if (mappedBe) {
          return { ...mappedBe, channel, alarmCode: be };
        }

        const le = payload.readUInt16LE(i);
        const mappedLe = this.mapVendorAlarmCode(le, { allowPlatformVideoCodes: true });
        if (mappedLe) {
          return { ...mappedLe, channel, alarmCode: le };
        }
      }
    }

    // Conservative fallback: for serial pass-through types, try first WORD only if explicitly mappable.
    if (!allowBinaryScan && payload.length >= 2 && (passThroughType === 0x41 || passThroughType === 0x42)) {
      const be = payload.readUInt16BE(0);
      const mappedBe = this.mapVendorAlarmCode(be, { allowPlatformVideoCodes: true });
      if (mappedBe) return { ...mappedBe, channel, alarmCode: be };

      const le = payload.readUInt16LE(0);
      const mappedLe = this.mapVendorAlarmCode(le, { allowPlatformVideoCodes: true });
      if (mappedLe) return { ...mappedLe, channel, alarmCode: le };
    }

    return null;
  }

  private inferLocationAlertChannel(alert: LocationAlert): number {
    if (alert.signalLossChannels && alert.signalLossChannels.length > 0) {
      return alert.signalLossChannels[0];
    }
    if (alert.blockingChannels && alert.blockingChannels.length > 0) {
      return alert.blockingChannels[0];
    }
    return 1;
  }

  private detectVendorAlarmFromLocationBody(
    body: Buffer
  ): { type: string; priority: AlertPriority; signalCode: string; channel?: number; alarmCode?: number; infoId?: number } | null {
    if (!body || body.length <= 28) return null;

    let offset = 28;
    while (offset + 2 <= body.length) {
      const infoId = body.readUInt8(offset);
      const infoLength = body.readUInt8(offset + 1);
      if (offset + 2 + infoLength > body.length) break;

      const infoData = body.slice(offset + 2, offset + 2 + infoLength);
      // Keep vendor alarm-code matching constrained to extension-style additional IDs.
      // Standard JT/T 808 additional items (e.g. 0x11~0x18) can contain values that
      // accidentally resemble short codes like 0x0104.
      const isVendorExtensionInfo = infoId >= 0x64;
      const mapped = isVendorExtensionInfo ? this.detectVendorAlarmFromPayload(infoData) : null;
      if (mapped) {
        return { ...mapped, infoId };
      }
      offset += 2 + infoLength;
    }
    return null;
  }

  private detectVendorAlarmFromPayload(
    payload: Buffer
  ): { type: string; priority: AlertPriority; signalCode: string; channel?: number; alarmCode?: number } | null {
    if (!payload || payload.length === 0) return null;

    // JT/T 808 Appendix A peripheral frames are commonly embedded in pass-through payloads.
    // Decode framed content first and inspect user-data for known alarm codes/text.
    const peripheralFrames = this.decodePeripheralProtocolFrames(payload);
    for (const frame of peripheralFrames) {
      const mapped = this.mapVendorAlarmFromBytes(frame.userData, false);
      if (mapped) {
        return mapped;
      }
    }

    // Fallback: inspect the raw payload directly.
    const mappedRaw = this.mapVendorAlarmFromBytes(payload, false);
    if (mappedRaw) return mappedRaw;

    return null;
  }

  private mapVendorAlarmFromBytes(
    payload: Buffer,
    allowPlatformVideoCodes: boolean
  ): { type: string; priority: AlertPriority; signalCode: string; channel?: number; alarmCode?: number } | null {
    if (!payload || payload.length === 0) return null;

    const decoded = this.decodeCustomPayloadText(payload) || '';
    const preview = this.buildPayloadPreview(payload, 320);
    const combined = `${decoded} ${preview}`.trim();
    const channelMatch = combined.match(/\bch(?:annel)?\s*[:#-]?\s*(\d{1,2})\b/i);
    const channel = channelMatch ? Number(channelMatch[1]) : undefined;

    const mappedByText = this.mapVendorAlarmText(combined);
    if (mappedByText) {
      return { ...mappedByText, channel };
    }

    const codeFromText = this.extractAlarmCodeFromText(combined);
    if (codeFromText !== null) {
      const mapped = this.mapVendorAlarmCode(codeFromText, { allowPlatformVideoCodes });
      if (mapped) return { ...mapped, channel, alarmCode: codeFromText };
    }

    // Check first WORD BE/LE.
    if (payload.length >= 2) {
      const be = payload.readUInt16BE(0);
      const mappedBe = this.mapVendorAlarmCode(be, { allowPlatformVideoCodes });
      if (mappedBe) return { ...mappedBe, channel, alarmCode: be };

      const le = payload.readUInt16LE(0);
      const mappedLe = this.mapVendorAlarmCode(le, { allowPlatformVideoCodes });
      if (mappedLe) return { ...mappedLe, channel, alarmCode: le };
    }

    // Broader deterministic scan: known alarm codes at any 2-byte offset.
    for (let i = 0; i <= payload.length - 2; i++) {
      const be = payload.readUInt16BE(i);
      const mappedBe = this.mapVendorAlarmCode(be, { allowPlatformVideoCodes });
      if (mappedBe) return { ...mappedBe, channel, alarmCode: be };

      const le = payload.readUInt16LE(i);
      const mappedLe = this.mapVendorAlarmCode(le, { allowPlatformVideoCodes });
      if (mappedLe) return { ...mappedLe, channel, alarmCode: le };
    }

    return null;
  }

  private decodePeripheralProtocolFrames(payload: Buffer): Array<{
    validChecksum: boolean;
    version: number;
    vendor: number;
    peripheralType: number;
    commandType: number;
    userData: Buffer;
  }> {
    const frames: Buffer[] = [];
    const marker = 0x7e;

    let start = -1;
    for (let i = 0; i < payload.length; i++) {
      if (payload[i] !== marker) continue;
      if (start >= 0 && i > start + 1) {
        frames.push(payload.slice(start + 1, i));
      }
      start = i;
    }

    // Some terminals strip 0x7e markers before pass-through; treat entire payload as one candidate too.
    if (frames.length === 0 && payload.length >= 6) {
      frames.push(payload);
    }

    const decoded: Array<{
      validChecksum: boolean;
      version: number;
      vendor: number;
      peripheralType: number;
      commandType: number;
      userData: Buffer;
    }> = [];

    for (const frame of frames) {
      const unescaped = this.unescapePeripheralFrame(frame);
      if (unescaped.length < 6) continue;

      const parsedCandidates: Array<{
        validChecksum: boolean;
        version: number;
        vendor: number;
        peripheralType: number;
        commandType: number;
        userData: Buffer;
      }> = [];

      // Layout A: check(1) + version(1) + vendor(2) + peripheral(1) + command(1) + user
      if (unescaped.length >= 6) {
        const checkCode = unescaped.readUInt8(0);
        const version = unescaped.readUInt8(1);
        const vendor = unescaped.readUInt16BE(2);
        const peripheralType = unescaped.readUInt8(4);
        const commandType = unescaped.readUInt8(5);
        const userData = unescaped.slice(6);
        let sum = 0;
        for (let i = 2; i < unescaped.length; i++) {
          sum = (sum + unescaped[i]) & 0xff;
        }
        parsedCandidates.push({
          validChecksum: sum === checkCode,
          version,
          vendor,
          peripheralType,
          commandType,
          userData
        });
      }

      // Layout B fallback: check(1) + version(2) + vendor(2) + peripheral(1) + command(1) + user
      if (unescaped.length >= 7) {
        const checkCode = unescaped.readUInt8(0);
        const version = unescaped.readUInt16BE(1);
        const vendor = unescaped.readUInt16BE(3);
        const peripheralType = unescaped.readUInt8(5);
        const commandType = unescaped.readUInt8(6);
        const userData = unescaped.slice(7);
        let sum = 0;
        for (let i = 3; i < unescaped.length; i++) {
          sum = (sum + unescaped[i]) & 0xff;
        }
        parsedCandidates.push({
          validChecksum: sum === checkCode,
          version,
          vendor,
          peripheralType,
          commandType,
          userData
        });
      }

      const chosen = parsedCandidates.find((c) => c.validChecksum) || parsedCandidates[0];
      if (chosen) decoded.push(chosen);
    }

    return decoded;
  }

  private unescapePeripheralFrame(frame: Buffer): Buffer {
    const out: number[] = [];
    for (let i = 0; i < frame.length; i++) {
      const b = frame[i];
      if (b === 0x7d && i + 1 < frame.length) {
        const n = frame[i + 1];
        if (n === 0x02) {
          out.push(0x7e);
          i++;
          continue;
        }
        if (n === 0x01) {
          out.push(0x7d);
          i++;
          continue;
        }
      }
      out.push(b);
    }
    return Buffer.from(out);
  }

  private extractAlarmCodeFromText(text: string): number | null {
    if (!text) return null;
    const hexMatch = text.match(/\b0x([0-9a-f]{4})\b/i);
    if (hexMatch) {
      return parseInt(hexMatch[1], 16);
    }
    const match = text.match(/\b(1000[1-8]|10016|10017|1010[1-7]|10116|10117|1120[1-3])\b/);
    return match ? Number(match[1]) : null;
  }

  private mapVendorAlarmCode(
    code: number,
    options: { allowPlatformVideoCodes?: boolean } = {}
  ): { type: string; priority: AlertPriority; signalCode: string } | null {
    const allowPlatformVideoCodes = options.allowPlatformVideoCodes ?? true;
    const map: Record<number, { type: string; priority: AlertPriority; signalCode: string }> = {
      0x0101: { type: 'Video Signal Loss', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0101' },
      0x0102: { type: 'Video Signal Blocking', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0102' },
      0x0103: { type: 'Storage Unit Failure', priority: AlertPriority.HIGH, signalCode: 'platform_video_alarm_0103' },
      0x0104: { type: 'Other Video Equipment Failure', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0104' },
      0x0105: { type: 'Bus Overcrowding', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0105' },
      0x0106: { type: 'Abnormal Driving Behavior', priority: AlertPriority.HIGH, signalCode: 'platform_video_alarm_0106' },
      0x0107: { type: 'Special Alarm Threshold', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0107' },

      10001: { type: 'ADAS: Forward collision warning', priority: AlertPriority.CRITICAL, signalCode: 'adas_10001_forward_collision_warning' },
      10002: { type: 'ADAS: Lane departure alarm', priority: AlertPriority.HIGH, signalCode: 'adas_10002_lane_departure_alarm' },
      10003: { type: 'ADAS: Following distance too close', priority: AlertPriority.HIGH, signalCode: 'adas_10003_following_distance_too_close' },
      10004: { type: 'ADAS: Pedestrian collision alarm', priority: AlertPriority.CRITICAL, signalCode: 'adas_10004_pedestrian_collision_alarm' },
      10005: { type: 'ADAS: Frequent lane change alarm', priority: AlertPriority.HIGH, signalCode: 'adas_10005_frequent_lane_change_alarm' },
      10006: { type: 'ADAS: Road sign over-limit alarm', priority: AlertPriority.MEDIUM, signalCode: 'adas_10006_road_sign_over_limit_alarm' },
      10007: { type: 'ADAS: Obstruction alarm', priority: AlertPriority.MEDIUM, signalCode: 'adas_10007_obstruction_alarm' },
      10008: { type: 'ADAS: Driver assistance function failure alarm', priority: AlertPriority.MEDIUM, signalCode: 'adas_10008_driver_assist_function_failure' },
      10016: { type: 'ADAS: Road sign identification event', priority: AlertPriority.LOW, signalCode: 'adas_10016_road_sign_identification_event' },
      10017: { type: 'ADAS: Active capture event', priority: AlertPriority.LOW, signalCode: 'adas_10017_active_capture_event' },

      10101: { type: 'DMS: Fatigue driving alarm', priority: AlertPriority.HIGH, signalCode: 'dms_10101_fatigue_driving_alarm' },
      10102: { type: 'DMS: Handheld phone alarm', priority: AlertPriority.HIGH, signalCode: 'dms_10102_handheld_phone_alarm' },
      10103: { type: 'DMS: Smoking alarm', priority: AlertPriority.HIGH, signalCode: 'dms_10103_smoking_alarm' },
      10104: { type: 'DMS: Forward camera invisible too long', priority: AlertPriority.HIGH, signalCode: 'dms_10104_forward_invisible_too_long' },
      10105: { type: 'DMS: Driver alarm not detected', priority: AlertPriority.MEDIUM, signalCode: 'dms_10105_driver_alarm_not_detected' },
      10106: { type: 'DMS: Both hands off steering wheel', priority: AlertPriority.HIGH, signalCode: 'dms_10106_hands_off_steering' },
      10107: { type: 'DMS: Driver behavior monitoring failure', priority: AlertPriority.MEDIUM, signalCode: 'dms_10107_behavior_monitoring_failure' },
      10116: { type: 'DMS: Automatic capture event', priority: AlertPriority.LOW, signalCode: 'dms_10116_automatic_capture_event' },
      10117: { type: 'DMS: Driver change', priority: AlertPriority.LOW, signalCode: 'dms_10117_driver_change' },

      11201: { type: 'Rapid acceleration', priority: AlertPriority.MEDIUM, signalCode: 'behavior_11201_rapid_acceleration' },
      11202: { type: 'Rapid deceleration', priority: AlertPriority.MEDIUM, signalCode: 'behavior_11202_rapid_deceleration' },
      11203: { type: 'Sharp turn', priority: AlertPriority.MEDIUM, signalCode: 'behavior_11203_sharp_turn' }
    };

    if (!allowPlatformVideoCodes && code >= 0x0101 && code <= 0x0107) {
      return null;
    }
    return map[code] || null;
  }

  private mapVendorAlarmText(text: string): { type: string; priority: AlertPriority; signalCode: string } | null {
    if (!text) return null;
    const candidates: Array<{ re: RegExp; map: { type: string; priority: AlertPriority; signalCode: string } }> = [
      { re: /\bforward\s+collision\s+warning\b/i, map: { type: 'ADAS: Forward collision warning', priority: AlertPriority.CRITICAL, signalCode: 'adas_10001_forward_collision_warning' } },
      { re: /\blane\s+departure\s+alarm\b/i, map: { type: 'ADAS: Lane departure alarm', priority: AlertPriority.HIGH, signalCode: 'adas_10002_lane_departure_alarm' } },
      { re: /\b(distance\s+is\s+too\s+close|too\s+close\s+to\s+the\s+alarm|following\s+distance)\b/i, map: { type: 'ADAS: Following distance too close', priority: AlertPriority.HIGH, signalCode: 'adas_10003_following_distance_too_close' } },
      { re: /\bpedestrian\s+collision\s+alarm\b/i, map: { type: 'ADAS: Pedestrian collision alarm', priority: AlertPriority.CRITICAL, signalCode: 'adas_10004_pedestrian_collision_alarm' } },
      { re: /\bfrequent\s+lane\s+change\s+alarm\b/i, map: { type: 'ADAS: Frequent lane change alarm', priority: AlertPriority.HIGH, signalCode: 'adas_10005_frequent_lane_change_alarm' } },
      { re: /\broad\s+sign\s+over[-\s]?limit\s+alarm\b/i, map: { type: 'ADAS: Road sign over-limit alarm', priority: AlertPriority.MEDIUM, signalCode: 'adas_10006_road_sign_over_limit_alarm' } },
      { re: /\bobstruction\s+alarm\b/i, map: { type: 'ADAS: Obstruction alarm', priority: AlertPriority.MEDIUM, signalCode: 'adas_10007_obstruction_alarm' } },
      { re: /\b(driver\s+assistance\s+function\s+failure\s+alarm|assist(?:ance)?\s+function\s+failure)\b/i, map: { type: 'ADAS: Driver assistance function failure alarm', priority: AlertPriority.MEDIUM, signalCode: 'adas_10008_driver_assist_function_failure' } },
      { re: /\broad\s+sign\s+identification\s+event\b/i, map: { type: 'ADAS: Road sign identification event', priority: AlertPriority.LOW, signalCode: 'adas_10016_road_sign_identification_event' } },
      { re: /\b(active(?:ly)?\s+capture(?:\s+the)?\s+event)\b/i, map: { type: 'ADAS: Active capture event', priority: AlertPriority.LOW, signalCode: 'adas_10017_active_capture_event' } },

      { re: /\bfatigue\s+driving\s+alarm\b/i, map: { type: 'DMS: Fatigue driving alarm', priority: AlertPriority.HIGH, signalCode: 'dms_10101_fatigue_driving_alarm' } },
      { re: /\b(handheld\s+phone\s+alarm|receive\s+handheld\s+phone\s+alarm)\b/i, map: { type: 'DMS: Handheld phone alarm', priority: AlertPriority.HIGH, signalCode: 'dms_10102_handheld_phone_alarm' } },
      { re: /\bsmoking\s+alarm\b/i, map: { type: 'DMS: Smoking alarm', priority: AlertPriority.HIGH, signalCode: 'dms_10103_smoking_alarm' } },
      { re: /\b(invisible\s+forward\s+alarm\s+for\s+a\s+long\s+time|forward\s+camera\s+invisible)\b/i, map: { type: 'DMS: Forward camera invisible too long', priority: AlertPriority.HIGH, signalCode: 'dms_10104_forward_invisible_too_long' } },
      { re: /\bdriver\s+alarm\s+not\s+detected\b/i, map: { type: 'DMS: Driver alarm not detected', priority: AlertPriority.MEDIUM, signalCode: 'dms_10105_driver_alarm_not_detected' } },
      { re: /\b(both\s+hands?\s+are\s+off\s+the\s+steering\s+wheel|hands?\s+off\s+steering)\b/i, map: { type: 'DMS: Both hands off steering wheel', priority: AlertPriority.HIGH, signalCode: 'dms_10106_hands_off_steering' } },
      { re: /\b(driver\s+behavior\s+monitoring\s+function\s+failure|behavior\s+monitoring\s+failure)\b/i, map: { type: 'DMS: Driver behavior monitoring failure', priority: AlertPriority.MEDIUM, signalCode: 'dms_10107_behavior_monitoring_failure' } },
      { re: /\bautomatic\s+capture\s+event\b/i, map: { type: 'DMS: Automatic capture event', priority: AlertPriority.LOW, signalCode: 'dms_10116_automatic_capture_event' } },
      { re: /\bdriver\s+change\b/i, map: { type: 'DMS: Driver change', priority: AlertPriority.LOW, signalCode: 'dms_10117_driver_change' } },

      { re: /\brapid\s+acceleration\b/i, map: { type: 'Rapid acceleration', priority: AlertPriority.MEDIUM, signalCode: 'behavior_11201_rapid_acceleration' } },
      { re: /\brapid\s+deceleration\b/i, map: { type: 'Rapid deceleration', priority: AlertPriority.MEDIUM, signalCode: 'behavior_11202_rapid_deceleration' } },
      { re: /\bsharp\s+turn\b/i, map: { type: 'Sharp turn', priority: AlertPriority.MEDIUM, signalCode: 'behavior_11203_sharp_turn' } }
    ];

    for (const entry of candidates) {
      if (entry.re.test(text)) {
        return entry.map;
      }
    }
    return null;
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
      alert.alarmFlags.collisionWarning ||
      alert.alarmFlags.rolloverWarning
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
  private handleResourceListSubpackage(
    vehicleId: string,
    bodyPart: Buffer,
    packetCount: number,
    packetIndex: number
  ): void {
    const key = vehicleId;
    const now = Date.now();
    const maxAgeMs = 30000;

    for (const [k, pending] of this.pendingResourceLists.entries()) {
      if (now - pending.createdAt > maxAgeMs) {
        this.pendingResourceLists.delete(k);
      }
    }

    let pending = this.pendingResourceLists.get(key);
    if (!pending || pending.packetCount !== packetCount || packetIndex === 1) {
      pending = {
        createdAt: now,
        packetCount,
        parts: new Map<number, Buffer>()
      };
      this.pendingResourceLists.set(key, pending);
    }

    pending.parts.set(packetIndex, bodyPart);
    console.log(`Resource list subpackage ${packetIndex}/${packetCount} from ${vehicleId} (partLen=${bodyPart.length})`);

    if (pending.parts.size < packetCount) {
      return;
    }

    const orderedParts: Buffer[] = [];
    for (let i = 1; i <= packetCount; i++) {
      const part = pending.parts.get(i);
      if (!part) {
        console.log(`Resource list assembly missing part ${i}/${packetCount} for ${vehicleId}`);
        return;
      }
      orderedParts.push(part);
    }

    this.pendingResourceLists.delete(key);
    const merged = Buffer.concat(orderedParts);
    console.log(`Resource list merged ${packetCount} packets for ${vehicleId} (len=${merged.length})`);
    this.parseResourceList(vehicleId, merged);
  }

  private parseResourceList(vehicleId: string, body: Buffer): void {
    if (body.length < 2) {
      console.log(`Resource list body too short: ${body.length} bytes`);
      return;
    }

    let listOffset = 0;
    let expectedTotal: number | undefined;
    let querySerial: number | undefined;

    // Preferred format per docs: [serial(2)][total(4)][items...]
    if (body.length >= 6 && (body.length - 6) % 28 === 0) {
      querySerial = body.readUInt16BE(0);
      expectedTotal = body.readUInt32BE(2);
      listOffset = 6;
      console.log(`Resource list header: serial=${querySerial}, total=${expectedTotal}`);
    } else if (body.length >= 2 && (body.length - 2) % 28 === 0) {
      // Compatibility: some terminals prepend count(2).
      expectedTotal = body.readUInt16BE(0);
      listOffset = 2;
      console.log(`Resource list header (compat): count=${expectedTotal}`);
    } else {
      // Last-resort: infer an item-aligned offset.
      listOffset = body.length >= 6 ? 6 : 2;
      while (listOffset > 0 && (body.length - listOffset) % 28 !== 0) {
        listOffset--;
      }
      console.log(`Resource list body non-standard: len=${body.length}, inferredOffset=${listOffset}`);
    }

    const payloadBytes = Math.max(0, body.length - listOffset);
    const itemCount = Math.floor(payloadBytes / 28);
    console.log(`Parsed ${itemCount} video file item(s)`);

    const items: ResourceVideoItem[] = [];
    let offset = listOffset;
    for (let i = 0; i < itemCount && offset + 28 <= body.length; i++) {
      const channel = body.readUInt8(offset);
      const startTime = this.parseBcdTime(body.slice(offset + 1, offset + 7));
      const endTime = this.parseBcdTime(body.slice(offset + 7, offset + 13));
      const alarmFlag64 = body.readBigUInt64BE(offset + 13);
      const alarmBits = this.getSetBits64(alarmFlag64);
      const alarmLabels = alarmBits.map((bit) => this.describeResourceAlarmBit(bit));
      const alarmFlag64Hex = `0x${alarmFlag64.toString(16).padStart(16, '0')}`;
      // Keep legacy low-byte compatibility for existing UI fields.
      const alarmType = Number(alarmFlag64 & 0xFFn);
      const mediaType = body.readUInt8(offset + 21);
      const streamType = body.readUInt8(offset + 22);
      const storageType = body.readUInt8(offset + 23);
      const fileSize = body.readUInt32BE(offset + 24);

      const alarmSummary = alarmLabels.length > 0 ? alarmLabels.join(', ') : 'none';
      console.log(`  File ${i + 1}: Ch${channel} ${startTime} to ${endTime} (${fileSize} bytes, alarm64=${alarmFlag64Hex}, flags=${alarmSummary})`);
      items.push({
        channel,
        startTime,
        endTime,
        alarmFlag64Hex,
        alarmBits,
        alarmLabels,
        alarmType,
        mediaType,
        streamType,
        storageType,
        fileSize
      });
      offset += 28;
    }

    if (typeof expectedTotal === 'number' && expectedTotal > 0 && expectedTotal !== items.length) {
      console.log(`Resource list partial parse: parsed=${items.length}, terminalTotal=${expectedTotal}`);
    }

    this.latestResourceLists.set(vehicleId, {
      receivedAt: Date.now(),
      items
    });
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

  private getSetBits64(value: bigint): number[] {
    const bits: number[] = [];
    for (let i = 0; i < 64; i++) {
      if (((value >> BigInt(i)) & 1n) === 1n) {
        bits.push(i);
      }
    }
    return bits;
  }

  private describeResourceAlarmBit(bit: number): string {
    const known: Record<number, string> = {
      0: 'Emergency alarm',
      1: 'Overspeed alarm',
      2: 'Fatigue driving alarm',
      3: 'Dangerous driving behavior',
      4: 'GNSS module failure',
      5: 'GNSS antenna disconnected',
      6: 'GNSS antenna short-circuit',
      7: 'Main power undervoltage',
      8: 'Main power power-down',
      9: 'Display failure',
      10: 'TTS module failure',
      11: 'Camera failure',
      12: 'IC module failure',
      13: 'Overspeed warning',
      14: 'Fatigue warning',
      29: 'Collision warning',
      30: 'Rollover warning',
      31: 'Illegal door open alarm',
      // 32-63 extend with JT/T 1078 Table 13 / Table 14 semantics.
      32: 'Video signal loss',
      33: 'Video signal blocking',
      34: 'Storage unit failure',
      35: 'Other video equipment failure',
      36: 'Bus overcrowding',
      37: 'Abnormal driving behavior',
      38: 'Special alarm recording threshold reached'
    };
    return known[bit] || `Alarm bit ${bit}`;
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
      this.udpPort
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

  setVideoAlarmMask(vehicleId: string, maskWord: number = 0): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildSetVideoAlarmMaskCommand(
      vehicleId,
      this.getNextSerial(),
      maskWord >>> 0
    );
    socket.write(command);
    return true;
  }

  setImageAnalysisAlarmParams(
    vehicleId: string,
    approvedPassengers: number,
    fatigueThreshold: number
  ): boolean {
    const vehicle = this.vehicles.get(vehicleId);
    const socket = this.connections.get(vehicleId);
    
    if (!vehicle || !socket || !vehicle.connected) {
      return false;
    }

    const command = JTT1078Commands.buildSetImageAnalysisAlarmParamsCommand(
      vehicleId,
      this.getNextSerial(),
      approvedPassengers,
      fatigueThreshold
    );
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

  getLatestResourceList(vehicleId: string): { receivedAt: number; items: ResourceVideoItem[] } | undefined {
    return this.latestResourceLists.get(vehicleId);
  }

  getRecentMessageTraces(options?: {
    vehicleId?: string;
    messageId?: number;
    limit?: number;
  }): MessageTraceEntry[] {
    const vehicleId = options?.vehicleId ? String(options.vehicleId).trim() : '';
    const messageId = typeof options?.messageId === 'number' ? options?.messageId : undefined;
    const limit = Math.max(1, Math.min(Number(options?.limit || 50), this.maxMessageTraceBuffer));

    let rows = [...this.recentMessageTraces];
    if (vehicleId) {
      rows = rows.filter((row) => row.vehicleId === vehicleId);
    }
    if (typeof messageId === 'number' && Number.isFinite(messageId)) {
      rows = rows.filter((row) => row.messageId === messageId);
    }

    return rows.slice(-limit).reverse();
  }

  async getAlerts() {
    return await this.alertStorage.getActiveAlerts();
  }

  async getDevices() {
    return await this.deviceStorage.getDevices();
  }

  private pushMessageTrace(message: any, rawFrame?: Buffer, parse?: Record<string, unknown>): void {
    const trace: MessageTraceEntry = {
      id: ++this.messageTraceSeq,
      receivedAt: new Date().toISOString(),
      vehicleId: String(message?.terminalPhone || ''),
      messageId: Number(message?.messageId || 0),
      messageIdHex: `0x${Number(message?.messageId || 0).toString(16).padStart(4, '0')}`,
      serialNumber: Number(message?.serialNumber || 0),
      bodyLength: Number(message?.body?.length || 0),
      isSubpackage: !!message?.isSubpackage,
      packetCount: message?.packetCount,
      packetIndex: message?.packetIndex,
      rawFrameHex: (rawFrame || Buffer.alloc(0)).toString('hex').slice(0, 8192),
      bodyHex: (message?.body || Buffer.alloc(0)).toString('hex').slice(0, 8192),
      bodyTextPreview: this.buildPayloadPreview(message?.body || Buffer.alloc(0), 320),
      parse: parse || undefined
    };

    this.recentMessageTraces.push(trace);
    if (this.recentMessageTraces.length > this.maxMessageTraceBuffer) {
      const overflow = this.recentMessageTraces.length - this.maxMessageTraceBuffer;
      this.recentMessageTraces.splice(0, overflow);
    }
  }

  private extractLocationAdditionalInfoFields(body: Buffer): Array<{
    idHex: string;
    idDec: number;
    length: number;
    dataHex: string;
  }> {
    const fields: Array<{
      idHex: string;
      idDec: number;
      length: number;
      dataHex: string;
    }> = [];

    if (!body || body.length < 30) return fields;

    let offset = 28;
    while (offset + 2 <= body.length) {
      const infoId = body.readUInt8(offset);
      const infoLength = body.readUInt8(offset + 1);
      if (offset + 2 + infoLength > body.length) break;

      const infoData = body.slice(offset + 2, offset + 2 + infoLength);
      fields.push({
        idHex: `0x${infoId.toString(16).padStart(2, '0')}`,
        idDec: infoId,
        length: infoLength,
        dataHex: infoData.toString('hex').slice(0, 512)
      });

      offset += 2 + infoLength;
      if (fields.length >= 64) break;
    }

    return fields;
  }

  private handleMultimediaEvent(message: any, socket: net.Socket): void {
    if (message.body.length >= 8) {
      const multimediaId = message.body.readUInt32BE(0);
      const multimediaType = message.body.readUInt8(4);
      const multimediaFormat = message.body.readUInt8(5);
      const eventCode = message.body.readUInt8(6);
      const channel = message.body.readUInt8(7);

      console.log(
        `Multimedia event from ${message.terminalPhone}: id=${multimediaId}, type=${multimediaType}, format=${multimediaFormat}, event=${eventCode}, ch=${channel}`
      );

      const mapped = this.mapMultimediaEvent(eventCode);
      if (mapped) {
        const last = this.lastKnownLocation.get(message.terminalPhone);
        void this.alertManager.processExternalAlert({
          vehicleId: message.terminalPhone,
          channel: channel || 1,
          type: mapped.type,
          signalCode: `external_multimedia_event_${eventCode}`,
          priority: mapped.priority,
          timestamp: new Date(),
          location: last ? { latitude: last.latitude, longitude: last.longitude } : undefined,
          metadata: {
            sourceMessageId: '0x0800',
            multimediaId,
            multimediaType,
            multimediaFormat,
            eventCode
          }
        });
      }
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

  private handleCustomMessage(message: any, socket: net.Socket): void {
    const decoded = this.decodeCustomPayloadText(message.body);
    const rawText = this.buildPayloadPreview(message.body, 220);
    const keywordAlert = this.extractKeywordAlert(rawText);
    const enableBinaryFallback = String(process.env.ENABLE_BINARY_CUSTOM_ALARM_FALLBACK ?? 'false').toLowerCase() === 'true';
    const binaryAlert = enableBinaryFallback ? this.extractKeywordAlertFromBinary(message.body) : null;
    const selectedAlert = keywordAlert || binaryAlert || null;

    const channelMatch = rawText.match(/\bch(?:annel)?\s*[:#-]?\s*(\d{1,2})\b/i);
    const inferredChannel = channelMatch ? Number(channelMatch[1]) : 1;
    const last = this.lastKnownLocation.get(message.terminalPhone);

    // For 0x0704 we store what terminal actually sent as the alert text.
    // This avoids over-classifying binary/gibberish payloads into wrong semantic alarms.
    void this.alertManager.processExternalAlert({
      vehicleId: message.terminalPhone,
      channel: selectedAlert?.channel || inferredChannel || 1,
      type: `0x0704 Raw: ${rawText.slice(0, 120)}`,
      signalCode: 'custom_raw_0704',
      priority: selectedAlert?.priority || AlertPriority.MEDIUM,
      timestamp: new Date(),
      location: last ? { latitude: last.latitude, longitude: last.longitude } : undefined,
      metadata: {
        sourceMessageId: '0x0704',
        customText: decoded || null,
        rawPayloadText: rawText,
        rawPayloadHex: message.body.toString('hex').slice(0, 512),
        keywordMatch: keywordAlert || null,
        binaryFallbackMatch: binaryAlert || null,
        binaryAlertFallbackUsed: !!binaryAlert && !keywordAlert
      }
    });

    const response = JTT1078Commands.buildGeneralResponse(
      message.terminalPhone,
      this.getNextSerial(),
      message.serialNumber,
      message.messageId,
      0
    );
    socket.write(response);
  }

  private buildPayloadPreview(payload: Buffer, maxLen: number = 220): string {
    if (!payload || payload.length === 0) return '(empty payload)';
    const ascii = payload
      .toString('latin1')
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (ascii.length > 0) {
      return ascii.slice(0, maxLen);
    }
    const hex = payload.toString('hex');
    return `[hex] ${hex.slice(0, maxLen)}`;
  }

  private mapMultimediaEvent(eventCode: number): { type: string; priority: AlertPriority } | null {
    // JT/T 808 multimedia event codes commonly used by terminals:
    // 0 platform command, 1 scheduled action, 2 robbery alarm, 3 collision/rollover,
    // 4/5 door open/close photos, 6 door open->close with speed crossing threshold, 7 fixed-distance photos.
    if (eventCode === 0 || eventCode === 1) return null;

    if (eventCode === 2) {
      return { type: 'Robbery Alarm Trigger', priority: AlertPriority.CRITICAL };
    }
    if (eventCode === 3) {
      return { type: 'Collision/Rollover Trigger', priority: AlertPriority.CRITICAL };
    }
    if (eventCode === 4) {
      return { type: 'Door Open Photo Event', priority: AlertPriority.LOW };
    }
    if (eventCode === 5) {
      return { type: 'Door Close Photo Event', priority: AlertPriority.LOW };
    }
    if (eventCode === 6) {
      return { type: 'Door Transition Speed Event', priority: AlertPriority.MEDIUM };
    }
    if (eventCode === 7) {
      return { type: 'Fixed Distance Photo Event', priority: AlertPriority.LOW };
    }

    // Other values are reserved/terminal-specific.
    return null;
  }

  private decodeCustomPayloadText(payload: Buffer): string | null {
    if (!payload || payload.length === 0) return null;

    const asciiSanitized = payload
      .toString('latin1')
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const candidates = [
      payload.toString('utf8'),
      payload.toString('latin1'),
      asciiSanitized
    ]
      .map((v) => v.replace(/\0/g, '').trim())
      .filter((v) => v.length > 0);

    let best: string | null = null;
    let bestScore = 0;
    for (const text of candidates) {
      let printable = 0;
      for (const ch of text) {
        const code = ch.charCodeAt(0);
        if ((code >= 32 && code <= 126) || ch === '\r' || ch === '\n' || ch === '\t') printable++;
      }
      const score = printable / Math.max(text.length, 1);
      if (score > bestScore) {
        bestScore = score;
        best = text;
      }
    }

    if (!best || bestScore < 0.45) return null;
    return best.slice(0, 400);
  }

  private extractKeywordAlertFromBinary(payload: Buffer): {
    type: string;
    priority: AlertPriority;
    signalCode: string;
    channel?: number;
  } | null {
    if (!payload || payload.length === 0) return null;

    // 1) Try keyword extraction from a binary-tolerant sanitized text stream.
    const sanitizedText = payload
      .toString('latin1')
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const keywordMatch = this.extractKeywordAlert(sanitizedText);
    if (keywordMatch) return keywordMatch;

    // 2) Try protocol alarm type codes (Table 38 style): 0x0101..0x0107.
    const codeMap: Record<number, { type: string; priority: AlertPriority; signalCode: string }> = {
      0x0101: { type: 'Video Signal Loss', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0101' },
      0x0102: { type: 'Video Signal Blocking', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0102' },
      0x0103: { type: 'Storage Unit Failure', priority: AlertPriority.HIGH, signalCode: 'platform_video_alarm_0103' },
      0x0104: { type: 'Other Video Equipment Failure', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0104' },
      0x0105: { type: 'Bus Overcrowding', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0105' },
      0x0106: { type: 'Abnormal Driving Behavior', priority: AlertPriority.HIGH, signalCode: 'platform_video_alarm_0106' },
      0x0107: { type: 'Special Alarm Threshold', priority: AlertPriority.MEDIUM, signalCode: 'platform_video_alarm_0107' }
    };

    for (let i = 0; i <= payload.length - 2; i++) {
      const code = payload.readUInt16BE(i);
      if (codeMap[code]) {
        return { ...codeMap[code] };
      }
    }

    return null;
  }

  private extractKeywordAlert(text: string): {
    type: string;
    priority: AlertPriority;
    signalCode: string;
    channel?: number;
  } | null {
    const patterns: Array<{ re: RegExp; type: string; priority: AlertPriority; signalCode: string }> = [
      { re: /\b(panic|sos|emergency)\b/i, type: 'Emergency Alarm', priority: AlertPriority.CRITICAL, signalCode: 'custom_keyword_emergency' },
      { re: /\b(collision|rollover|crash|accident)\b/i, type: 'Collision/Accident', priority: AlertPriority.CRITICAL, signalCode: 'custom_keyword_collision' },
      { re: /\b(fatigue|yawn|drowsy|sleepy)\b/i, type: 'Driver Fatigue', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_fatigue' },
      { re: /\b(seat\s*belt|seatbelt|seatbelt\s*detected|unbelted|no\s*seat\s*belt|without\s*seat\s*belt)\b/i, type: 'No Seatbelt', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_no_seatbelt' },
      { re: /\b(smok|cigarette)\b/i, type: 'Smoking While Driving', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_smoking' },
      { re: /\b(phone|cellphone|mobile)\b/i, type: 'Phone Use While Driving', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_phone' },
      { re: /\b(speed|overspeed)\b/i, type: 'Overspeed Alert', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_speed' },
      { re: /\b(camera).*(covered|blocked|mask|obstruct)/i, type: 'Camera Covered', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_camera_covered' },
      { re: /\b(storage|memory).*(fail|error|fault)/i, type: 'Storage Failure', priority: AlertPriority.HIGH, signalCode: 'custom_keyword_storage_failure' },
      { re: /\b(gnss|gps).*(antenna).*(disconnect|fault|error)/i, type: 'GNSS Antenna Issue', priority: AlertPriority.MEDIUM, signalCode: 'custom_keyword_gnss_antenna' },
      { re: /\b(alert|alarm|warning|violation)\b/i, type: 'Custom Alert', priority: AlertPriority.MEDIUM, signalCode: 'custom_keyword_alert' }
    ];

    const matched = patterns.find((p) => p.re.test(text));
    if (!matched) return null;

    const channelMatch = text.match(/\bch(?:annel)?\s*[:#-]?\s*(\d{1,2})\b/i);
    const channel = channelMatch ? Number(channelMatch[1]) : undefined;

    return {
      type: matched.type,
      priority: matched.priority,
      signalCode: matched.signalCode,
      channel
    };
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










