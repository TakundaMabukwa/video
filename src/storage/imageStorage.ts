import * as fs from 'fs';
import * as path from 'path';
import { query } from './database';
import { supabase } from './supabase';

export class ImageStorage {
  async saveImage(deviceId: string, channel: number, imageData: Buffer): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${deviceId}/ch${channel}/${timestamp}.jpg`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filename, imageData, {
        contentType: 'image/jpeg',
        upsert: false
      });
    
    if (error) {
      console.error('Supabase upload failed:', error);
      throw error;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filename);
    
    const storageUrl = urlData.publicUrl;
    
    // Save to database
    const result = await query(
      `INSERT INTO images (device_id, channel, file_path, storage_url, file_size, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [deviceId, channel, filename, storageUrl, imageData.length, new Date()]
    );
    
    console.log(`📸 Image uploaded: ${storageUrl}`);
    return result.rows[0].id;
  }

  async saveImageFromPath(deviceId: string, channel: number, localPath: string, fileSize: number): Promise<string> {
    const imageData = fs.readFileSync(localPath);
    return this.saveImage(deviceId, channel, imageData);
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
}
