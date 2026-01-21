import * as fs from 'fs';
import * as path from 'path';
import { query } from './database';
import { supabase, ensureBucket } from './supabase';

export class ImageStorage {
  private bucketReady: Promise<string>;

  constructor() {
    this.bucketReady = ensureBucket();
  }

  async saveImage(deviceId: string, channel: number, imageData: Buffer, alertId?: string): Promise<string> {
    const bucketName = await this.bucketReady;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${deviceId}/ch${channel}/${timestamp}.jpg`;

    // Check file size (Supabase limit: 300MB)
    const maxSize = 300 * 1024 * 1024; // 300MB
    if (imageData.length > maxSize) {
      console.error(`❌ Image too large: ${(imageData.length / 1024 / 1024).toFixed(2)}MB (max 300MB)`);
      // Save to database without Supabase upload
      const result = await query(
        `INSERT INTO images (device_id, channel, file_path, storage_url, file_size, timestamp, alert_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [deviceId, channel, filename, 'local-only', imageData.length, new Date(), alertId || null]
      );
      return result.rows[0].id;
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filename, imageData, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload failed:', error);
      // Save to database anyway
      const result = await query(
        `INSERT INTO images (device_id, channel, file_path, storage_url, file_size, timestamp, alert_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [deviceId, channel, filename, 'upload-failed', imageData.length, new Date(), alertId || null]
      );
      return result.rows[0].id;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);

    const storageUrl = urlData.publicUrl;

    // Save to database
    const result = await query(
      `INSERT INTO images (device_id, channel, file_path, storage_url, file_size, timestamp, alert_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [deviceId, channel, filename, storageUrl, imageData.length, new Date(), alertId || null]
    );

    console.log(`📸 Image uploaded: ${storageUrl}`);
    return result.rows[0].id;
  }

  async saveImageFromPath(deviceId: string, channel: number, localPath: string, fileSize: number, alertId?: string): Promise<string> {
    const imageData = fs.readFileSync(localPath);
    return this.saveImage(deviceId, channel, imageData, alertId);
  }

  async getImages(deviceId: string, limit: number = 50) {
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
