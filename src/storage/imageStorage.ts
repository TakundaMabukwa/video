import * as fs from 'fs';
import * as path from 'path';
import { isDatabaseEnabled, query } from './database';

type LocalImageRecord = {
  id: string;
  device_id: string;
  channel: number;
  file_path: string;
  storage_url: string;
  file_size: number;
  timestamp: string;
  alert_id: string | null;
};

export class ImageStorage {
  private static localImageIndex = new Map<string, string>();
  private static localRecentImages: LocalImageRecord[] = [];
  private readonly localRoot: string;
  private readonly dbEnabled: boolean;

  constructor() {
    this.dbEnabled = isDatabaseEnabled();
    this.localRoot = path.join(process.cwd(), 'media', 'images');
    try {
      fs.mkdirSync(this.localRoot, { recursive: true });
    } catch {}
  }

  private buildLocalPath(relativeFilePath: string): string {
    return path.join(this.localRoot, relativeFilePath);
  }

  getLocalImagePath(id: string): string | null {
    const key = String(id || '').trim();
    if (!key) return null;
    return ImageStorage.localImageIndex.get(key) || null;
  }

  getRecentImages(limit: number = 50, minutes: number = 30, alertsOnly: boolean = false): LocalImageRecord[] {
    const cutoff = Date.now() - Math.max(1, minutes) * 60 * 1000;
    return ImageStorage.localRecentImages
      .filter((img) => {
        const ts = Date.parse(img.timestamp);
        if (Number.isNaN(ts) || ts < cutoff) return false;
        if (alertsOnly && !img.alert_id) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, Math.max(1, limit));
  }

  async saveImage(
    deviceId: string,
    channel: number,
    imageData: Buffer,
    alertId?: string,
    capturedAt?: Date
  ): Promise<string> {
    const captureTime = capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : new Date();
    const timestamp = captureTime.toISOString().replace(/[:.]/g, '-');
    const relativeFilePath = `${deviceId}/ch${channel}/${timestamp}.jpg`;
    const localPath = this.buildLocalPath(relativeFilePath);

    try {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, imageData);
    } catch (err: any) {
      console.error(`Failed to persist local screenshot ${localPath}:`, err?.message || err);
    }

    if (!this.dbEnabled) {
      const id = `local-image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      ImageStorage.localImageIndex.set(id, localPath);
      ImageStorage.localRecentImages.unshift({
        id,
        device_id: deviceId,
        channel,
        file_path: relativeFilePath,
        storage_url: `/api/images/${id}/file`,
        file_size: imageData.length,
        timestamp: captureTime.toISOString(),
        alert_id: alertId || null,
      });
      ImageStorage.localRecentImages = ImageStorage.localRecentImages.slice(0, 2000);
      return id;
    }

    const result = await query(
      `INSERT INTO images (device_id, channel, file_path, storage_url, file_size, timestamp, alert_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [deviceId, channel, relativeFilePath, '', imageData.length, captureTime, alertId || null]
    );

    const id = result.rows[0].id;
    await query(`UPDATE images SET storage_url = $1 WHERE id = $2`, [`/api/images/${id}/file`, id]);
    ImageStorage.localImageIndex.set(String(id), localPath);
    return id;
  }

  async saveImageFromPath(
    deviceId: string,
    channel: number,
    localPath: string,
    fileSize: number,
    alertId?: string,
    capturedAt?: Date
  ): Promise<string> {
    const imageData = fs.readFileSync(localPath);
    return this.saveImage(deviceId, channel, imageData, alertId, capturedAt);
  }

  async getImages(deviceId: string, limit: number = 50) {
    if (!this.dbEnabled) return [];
    const result = await query(
      `SELECT id, device_id, channel, storage_url, file_size, timestamp
       FROM images
       WHERE device_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [deviceId, limit]
    );
    return result.rows;
  }

  async getAlertImages(alertId: string) {
    if (!this.dbEnabled) return [];
    const result = await query(
      `SELECT id, device_id, channel, storage_url, file_size, timestamp
       FROM images
       WHERE alert_id = $1
       ORDER BY timestamp DESC`,
      [alertId]
    );
    return result.rows;
  }
}
