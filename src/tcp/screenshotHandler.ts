import { Socket } from 'net';
import { createJTTMessage } from './messageBuilder';

export function requestScreenshot(socket: Socket, vehicleId: string, channelId: number = 1): void {
  // 0x9201 - Remote video playback request (Table 24)
  const payload = Buffer.alloc(16);
  let offset = 0;
  
  // Server channel ID (4 bytes)
  payload.writeUInt32BE(1, offset);
  offset += 4;
  
  // Playback method: 4 = Single frame upload (1 byte)
  payload.writeUInt8(4, offset);
  offset += 1;
  
  // Fast forward multiple (1 byte) - not used for single frame
  payload.writeUInt8(0, offset);
  offset += 1;
  
  // Timestamp (6 bytes BCD) - current time
  const now = new Date();
  const year = now.getFullYear() % 100;
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  
  payload.writeUInt8(parseInt(year.toString().padStart(2, '0'), 16), offset++);
  payload.writeUInt8(parseInt(month.toString().padStart(2, '0'), 16), offset++);
  payload.writeUInt8(parseInt(day.toString().padStart(2, '0'), 16), offset++);
  payload.writeUInt8(parseInt(hour.toString().padStart(2, '0'), 16), offset++);
  payload.writeUInt8(parseInt(minute.toString().padStart(2, '0'), 16), offset++);
  payload.writeUInt8(parseInt(second.toString().padStart(2, '0'), 16), offset++);
  
  // Channel ID (1 byte)
  payload.writeUInt8(channelId, offset);
  offset += 1;
  
  // Reserved (3 bytes)
  payload.writeUInt8(0, offset++);
  payload.writeUInt8(0, offset++);
  payload.writeUInt8(0, offset++);
  
  const message = createJTTMessage(0x9201, payload, vehicleId);
  socket.write(message);
  
  console.log(`📸 Screenshot requested for vehicle ${vehicleId}, channel ${channelId}`);
}