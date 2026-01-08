import * as fs from 'fs';
import * as path from 'path';

export class MultimediaParser {
  static parseMultimediaData(body: Buffer, vehicleId: string): { type: string; data: Buffer; filename: string } | null {
    if (body.length < 28) return null;

    try {
      console.log(`\n📦 Multimedia packet: ${body.length} bytes`);
      console.log(`First 64 bytes: ${body.slice(0, 64).toString('hex')}`);
      
      // JT/T 808 multimedia data format (Table 17)
      const multimediaId = body.readUInt32BE(0);
      const multimediaType = body.readUInt8(4);
      const multimediaFormat = body.readUInt8(5);
      const eventCode = body.readUInt8(6);
      const channelId = body.readUInt8(7);
      
      console.log(`ID=${multimediaId}, Type=${multimediaType}, Format=${multimediaFormat}, Event=${eventCode}, Ch=${channelId}`);
      
      // Extract actual multimedia data (after 36-byte header)
      let multimediaData = body.slice(36);
      console.log(`Data after header: ${multimediaData.length} bytes, first 32: ${multimediaData.slice(0, 32).toString('hex')}`);
      
      // For images, look for JPEG magic bytes
      if (multimediaType === 0) {
        let jpegStart = -1;
        for (let i = 0; i < Math.min(200, multimediaData.length - 2); i++) {
          if (multimediaData[i] === 0xFF && multimediaData[i + 1] === 0xD8) {
            jpegStart = i;
            console.log(`✅ JPEG start (FF D8) at offset ${i}`);
            break;
          }
        }
        
        if (jpegStart === -1) {
          console.log(`❌ NO JPEG MARKER FOUND in first 200 bytes`);
          console.log(`Full data (first 100): ${multimediaData.slice(0, 100).toString('hex')}`);
          return null;
        }
        
        multimediaData = multimediaData.slice(jpegStart);
        
        // Find JPEG end marker
        let jpegEnd = -1;
        for (let i = multimediaData.length - 2; i >= 0; i--) {
          if (multimediaData[i] === 0xFF && multimediaData[i + 1] === 0xD9) {
            jpegEnd = i + 2;
            console.log(`✅ JPEG end (FF D9) at offset ${i}`);
            break;
          }
        }
        
        if (jpegEnd > 0) {
          multimediaData = multimediaData.slice(0, jpegEnd);
          console.log(`✅ Valid JPEG: ${multimediaData.length} bytes`);
        } else {
          console.log(`⚠️ No JPEG end marker, using full data: ${multimediaData.length} bytes`);
        }
      }
      
      // Determine file type and extension
      let fileType = 'unknown';
      let extension = '.bin';
      
      if (multimediaType === 0) {
        if (multimediaFormat === 0) {
          fileType = 'jpeg';
          extension = '.jpg';
        } else if (multimediaFormat === 1) {
          fileType = 'tiff';
          extension = '.tiff';
        }
      } else if (multimediaType === 1) {
        fileType = 'wav';
        extension = '.wav';
      } else if (multimediaType === 2) {
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