// JT/T 808 & JT/T 1078 Protocol Types and Enums

export enum JTT808MessageType {
  TERMINAL_REGISTER = 0x0100,
  TERMINAL_AUTH = 0x0102,
  HEARTBEAT = 0x0002,
  LOCATION_REPORT = 0x0200,
  PLATFORM_GENERAL_RESPONSE = 0x8001,
  START_VIDEO_REQUEST = 0x9101
}

export enum JTT1078SubpackageFlag {
  ATOMIC = 0b00,      // Complete frame in single packet
  FIRST = 0b01,       // First subpackage of frame
  LAST = 0b10,        // Last subpackage of frame  
  MIDDLE = 0b11       // Middle subpackage of frame
}

export interface JTT808Message {
  messageId: number;
  bodyLength: number;
  terminalPhone: string;
  serialNumber: number;
  body: Buffer;
  checksum: number;
}

export interface JTT1078RTPHeader {
  frameHeader: number;    // 0x30316364
  version: number;        // RTP version
  padding: boolean;
  extension: boolean;
  csrcCount: number;
  marker: boolean;
  payloadType: number;
  sequenceNumber: number;
  timestamp: number;
  ssrc: number;
  channelNumber: number;
  subpackageFlag: JTT1078SubpackageFlag;
  payloadLength: number;
}

export interface Vehicle {
  id: string;
  phone: string;
  connected: boolean;
  lastHeartbeat: Date;
  activeStreams: Set<number>;
}

export interface StreamInfo {
  vehicleId: string;
  channel: number;
  active: boolean;
  frameCount: number;
  lastFrame: Date | null;
}