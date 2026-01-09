import { query } from './database';

export class DeviceStorage {
  async upsertDevice(deviceId: string, ipAddress: string) {
    await query(
      `INSERT INTO devices (device_id, ip_address, last_seen)
       VALUES ($1, $2, NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         ip_address = EXCLUDED.ip_address,
         last_seen = NOW()`,
      [deviceId, ipAddress]
    );
  }

  async getDevice(deviceId: string) {
    const result = await query(`SELECT * FROM devices WHERE device_id = $1`, [deviceId]);
    return result.rows[0];
  }

  async getAllDevices() {
    const result = await query(`SELECT * FROM devices ORDER BY last_seen DESC`);
    return result.rows;
  }
}
