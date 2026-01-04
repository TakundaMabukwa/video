import * as fs from 'fs';
import * as path from 'path';

export class MultimediaParser {
  static parseMultimediaData(body: Buffer, vehicleId: string): { type: string; data: Buffer; filename: string } | null {
    if (body.length < 28) return null;

    try {
      console.log(`Raw multimedia body (${body.length} bytes): ${body.slice(0, 32).toString('hex')}`);
      
      // JT/T 808 multimedia data format (Table 17)
      const multimediaId = body.readUInt32BE(0);
      const multimediaType = body.readUInt8(4);
      const multimediaFormat = body.readUInt8(5);
      const eventCode = body.readUInt8(6);
      const channelId = body.readUInt8(7);
      
      // Location data (28 bytes) - skip for now
      const locationData = body.slice(8, 36);
      
      console.log(`Multimedia: ID=${multimediaId}, Type=${multimediaType}, Format=${multimediaFormat}, Event=${eventCode}, Channel=${channelId}`);
      
      // Extract actual multimedia data (after 36-byte header)
      let multimediaData = body.slice(36);
      
      // For images, look for JPEG magic bytes
      if (multimediaType === 0) {
        // Search for JPEG start in the remaining data
        for (let i = 0; i < Math.min(100, multimediaData.length - 2); i++) {
          if (multimediaData[i] === 0xFF && multimediaData[i + 1] === 0xD8) {
            console.log(`✅ Found JPEG at offset ${i} in multimedia data`);
            multimediaData = multimediaData.slice(i);
            break;
          }
        }
        
        // Validate JPEG end marker
        const lastBytes = multimediaData.slice(-2);
        if (lastBytes[0] === 0xFF && lastBytes[1] === 0xD9) {
          console.log('✅ Valid JPEG with end marker');
        } else {
          console.log('⚠️ JPEG missing end marker, truncating at last valid data');
        }
      }
      
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