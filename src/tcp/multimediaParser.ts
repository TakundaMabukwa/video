import * as fs from 'fs';
import * as path from 'path';

interface MultimediaFragment {
  id: number;
  vehicleId: string;
  fragments: Buffer[];
  timestamp: Date;
}

export class MultimediaParser {
  private static fragmentBuffers = new Map<string, MultimediaFragment>();

  static parseMultimediaData(body: Buffer, vehicleId: string): { type: string; data: Buffer; filename: string } | null {
    if (body.length < 8) return null;

    try {
      const multimediaId = body.readUInt32BE(0);
      const multimediaType = body.readUInt8(4);
      const multimediaFormat = body.readUInt8(5);
      const eventCode = body.readUInt8(6);
      const channelId = body.readUInt8(7);
      
      // Check if this is a fragmented packet (Type 0xFF = JPEG start in data)
      if (body.length >= 12 && body[8] === 0xFF && body[9] === 0xD8) {
        console.log(`\u2705 JPEG fragment start: ID=${multimediaId}`);
        const key = `${vehicleId}_${multimediaId}`;
        this.fragmentBuffers.set(key, {
          id: multimediaId,
          vehicleId,
          fragments: [body.slice(8)],
          timestamp: new Date()
        });
        return null; // Wait for more fragments
      }
      
      // Check if this is a continuation fragment
      const key = `${vehicleId}_${multimediaId}`;
      const existing = this.fragmentBuffers.get(key);
      
      if (existing) {
        existing.fragments.push(body.slice(8));
        
        // Check if we have JPEG end marker
        const lastFragment = body.slice(8);
        let hasEnd = false;
        for (let i = lastFragment.length - 2; i >= 0; i--) {
          if (lastFragment[i] === 0xFF && lastFragment[i + 1] === 0xD9) {
            hasEnd = true;
            break;
          }
        }
        
        if (hasEnd) {
          console.log(`\u2705 JPEG complete: ${existing.fragments.length} fragments`);
          const fullData = Buffer.concat(existing.fragments);
          this.fragmentBuffers.delete(key);
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${vehicleId}_ch${channelId}_${timestamp}_event${eventCode}.jpg`;
          
          return {
            type: 'jpeg',
            data: fullData,
            filename
          };
        }
        
        return null; // Wait for more fragments
      }
      
      // Single-packet image (old format)
      if (body.length < 36) return null;
      
      let multimediaData = body.slice(36);
      
      // Search for JPEG markers
      if (multimediaType === 0) {
        let jpegStart = -1;
        for (let i = 0; i < Math.min(200, multimediaData.length - 2); i++) {
          if (multimediaData[i] === 0xFF && multimediaData[i + 1] === 0xD8) {
            jpegStart = i;
            break;
          }
        }
        
        if (jpegStart === -1) return null;
        
        multimediaData = multimediaData.slice(jpegStart);
        
        // Find end marker
        for (let i = multimediaData.length - 2; i >= 0; i--) {
          if (multimediaData[i] === 0xFF && multimediaData[i + 1] === 0xD9) {
            multimediaData = multimediaData.slice(0, i + 2);
            break;
          }
        }
      }
      
      let fileType = 'unknown';
      let extension = '.bin';
      
      if (multimediaType === 0) {
        fileType = 'jpeg';
        extension = '.jpg';
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
  
  // Cleanup old fragments (call periodically)
  static cleanupFragments(): void {
    const now = Date.now();
    for (const [key, frag] of this.fragmentBuffers.entries()) {
      if (now - frag.timestamp.getTime() > 30000) {
        this.fragmentBuffers.delete(key);
      }
    }
  }
}