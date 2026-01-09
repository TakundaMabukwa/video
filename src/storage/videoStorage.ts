import { query } from './database';

export class VideoStorage {
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
