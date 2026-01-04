import * as fs from 'fs';
import * as path from 'path';

export class MultimediaParser {
  static parseMultimediaData(body: Buffer, vehicleId: string): { type: string; data: Buffer; filename: string } | null {
    if (body.length < 8) return null;

    try {
      // JT/T 808 multimedia data format
      const multimediaId = body.readUInt32BE(0);
      const multimediaType = body.readUInt8(4);
      const multimediaFormat = body.readUInt8(5);
      const eventCode = body.readUInt8(6);
      const channelId = body.readUInt8(7);
      
      // Extract actual multimedia data (after 8-byte header)
      const multimediaData = body.slice(8);
      
      // Determine file type and extension
      let fileType = 'unknown';
      let extension = '.bin';
      
      if (multimediaType === 0) { // Image
        if (multimediaFormat === 0) {
          fileType = 'jpeg';
          extension = '.jpg';
        } else if (multimediaFormat === 1) {
          fileType = 'tiff';
          extension = '.tiff';
        } else if (multimediaFormat === 2) {
          fileType = 'mp4';
          extension = '.mp4';
        } else if (multimediaFormat === 3) {
          fileType = 'avi';
          extension = '.avi';
        }
      } else if (multimediaType === 1) { // Audio
        fileType = 'wav';
        extension = '.wav';
      } else if (multimediaType === 2) { // Video
        fileType = 'mp4';
        extension = '.mp4';
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${vehicleId}_ch${channelId}_${timestamp}_event${eventCode}${extension}`;
      
      return {
        type: fileType,
        data: multimediaData,
        filename
      };
    } catch (error) {
      console.error('Failed to parse multimedia data:', error);
      return null;
    }
  }

  static saveMultimediaFile(vehicleId: string, filename: string, data: Buffer): string {
    const mediaDir = path.join(process.cwd(), 'media', vehicleId);
    
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    
    const filePath = path.join(mediaDir, filename);
    fs.writeFileSync(filePath, data);
    
    return filePath;
  }
}