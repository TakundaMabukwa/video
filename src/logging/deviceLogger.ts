import * as fs from 'fs';
import * as path from 'path';

interface DeviceEntry {
  vehicleId: string;
  phone: string;
  firstSeen: string;
  lastSeen: string;
  ipAddress: string;
  connectionCount: number;
}

export class DeviceLogger {
  private logFile: string;
  private devices = new Map<string, DeviceEntry>();

  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'devices.json');
    this.ensureLogDirectory();
    this.loadExistingDevices();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private loadExistingDevices(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        const data = fs.readFileSync(this.logFile, 'utf8');
        const devices = JSON.parse(data);
        for (const device of devices) {
          this.devices.set(device.vehicleId, device);
        }
      }
    } catch (error) {
      console.error('Failed to load existing devices:', error);
    }
  }

  logDevice(vehicleId: string, phone: string, ipAddress: string): boolean {
    const now = new Date().toISOString();
    const existing = this.devices.get(vehicleId);
    
    if (existing) {
      existing.lastSeen = now;
      existing.connectionCount++;
      this.saveDevices();
      return false; // Not new
    } else {
      const newDevice: DeviceEntry = {
        vehicleId,
        phone,
        firstSeen: now,
        lastSeen: now,
        ipAddress,
        connectionCount: 1
      };
      
      this.devices.set(vehicleId, newDevice);
      console.log(`🆕 NEW DEVICE: ${vehicleId} (${phone}) from ${ipAddress}`);
      this.saveDevices();
      return true; // New device
    }
  }

  private saveDevices(): void {
    try {
      const deviceArray = Array.from(this.devices.values());
      fs.writeFileSync(this.logFile, JSON.stringify(deviceArray, null, 2));
    } catch (error) {
      console.error('Failed to save devices:', error);
    }
  }

  getDevices(): DeviceEntry[] {
    return Array.from(this.devices.values());
  }
}