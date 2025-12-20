import * as net from 'net';
import { JTT808Parser } from './parser';
import { JTT1078Commands } from './commands';
import { JTT808MessageType, Vehicle } from '../types/jtt';

export class JTT808Server {
  private server: net.Server;
  private vehicles = new Map<string, Vehicle>();
  private connections = new Map<string, net.Socket>();
  private serialCounter = 1;
  private rtpHandler?: (buffer: Buffer, vehicleId: string) => void;

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
      buffer = Buffer.concat([buffer, data]);
      
      // Process complete messages
      while (buffer.length > 0) {
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
    // Check for RTP video data (0x30316364)
    if (buffer.length > 4 && buffer.readUInt32BE(1) === 0x30316364) {
      this.handleRTPData(buffer.slice(1), socket);
      return;
    }

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
      case 0x0001: // Terminal general response
        console.log(`Terminal response 0x1, body: ${message.body.toString('hex')}`);
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
    // Send auth response (success)
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
      this.port,
      channel
    );
    
    console.log(`Sending 0x9101: IP=${serverIp}, Port=${this.port}, Channel=${channel}`);
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
}