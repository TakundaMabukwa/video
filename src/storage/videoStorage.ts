import { query } from './database';
import { supabase, ensureBucket } from './supabase';
import * as fs from 'fs';

export class VideoStorage {
  private bucketReady: Promise<string>;

  constructor() {
    this.bucketReady = ensureBucket();
  }

  async saveVideo(deviceId: string, channel: number, filePath: string, startTime: Date, videoType: 'live' | 'alert_pre' | 'alert_post', alertId?: string) {
    const result = await query(
      `INSERT INTO videos (device_id, channel, file_path, start_time, video_type, alert_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [deviceId, channel, filePath, startTime, videoType, alertId || null]
    );
    return result.rows[0].id;
  }

  async updateVideoEnd(id: string, endTime: Date, fileSize: number, duration: number) {
    await query(
      `UPDATE videos SET end_time = $1, file_size = $2, duration_seconds = $3 WHERE id = $4`,
      [endTime, fileSize, duration, id]
    );
  }

  async uploadVideoToSupabase(id: string, localPath: string, deviceId: string, channel: number): Promise<string> {
    const bucketName = await this.bucketReady;

    // Check file size before reading
    const stats = fs.statSync(localPath);
    const maxSize = 150 * 1024 * 1024; // 150MB Supabase limit

    if (stats.size > maxSize) {
      console.warn(`⚠️ Video too large for Supabase: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max 150MB). Skipping upload.`);
      console.log(`📁 Video stored locally only: ${localPath}`);
      return localPath; // Return local path instead
    }

    const videoData = fs.readFileSync(localPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${deviceId}/ch${channel}/${timestamp}.h264`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filename, videoData, {
        contentType: 'video/h264',
        upsert: false
      });

    if (error) {
      console.error('Supabase video upload failed:', error);
      console.log(`📁 Video stored locally only: ${localPath}`);
      return localPath; // Fallback to local path
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);

    const storageUrl = urlData.publicUrl;

    // Update database with storage URL
    await query(
      `UPDATE videos SET storage_url = $1 WHERE id = $2`,
      [storageUrl, id]
    );

    console.log(`📹 Video uploaded to Supabase: ${storageUrl}`);
    return storageUrl;
  }

  async getVideos(deviceId: string, limit: number = 50) {
    const result = await query(
      `SELECT * FROM videos WHERE device_id = $1 ORDER BY start_time DESC LIMIT $2`,
      [deviceId, limit]
    );
    return result.rows;
  }

  async getAlertVideos(alertId: string) {
    const result = await query(
      `SELECT * FROM videos WHERE alert_id = $1 ORDER BY video_type`,
      [alertId]
    );
    return result.rows;
  }
}
