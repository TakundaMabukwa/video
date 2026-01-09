import * as fs from 'fs';
import * as path from 'path';
import { ImageStorage } from '../storage/imageStorage';

interface MultimediaFragment {
  id: number;
  vehicleId: string;
  fragments: Buffer[];
  timestamp: Date;
}

export class MultimediaParser {
  private static fragmentBuffers = new Map<string, MultimediaFragment>();
  private static imageStorage = new ImageStorage();

  static parseMultimediaData(body: Buffer, vehicleId: string): { type: string; data: Buffer; filename: string } | null {
    if (body.length < 8) return null;

    try {
      const multimediaId = body.readUInt32BE(0);
      const multimediaType = body.readUInt8(4); // 0=image, 1=audio, 2=video
      const multimediaFormat = body.readUInt8(5); // 0=JPEG, 1=TIF, 2=MP3, 3=WAV, 4=WMV
      const eventCode = body.readUInt8(6);
      const channelId = body.readUInt8(7);
      
      // Data starts at byte 8
      const imageData = body.slice(8);
      
      // Validate JPEG header (0xFFD8)
      if (imageData.length >= 2 && imageData[0] === 0xFF && imageData[1] === 0xD8) {
        // Find JPEG end marker (0xFFD9)
        let jpegEnd = -1;
        for (let i = imageData.length - 2; i >= 0; i--) {
          if (imageData[i] === 0xFF && imageData[i + 1] === 0xD9) {
            jpegEnd = i + 2;
            break;
          }
        }
        
        if (jpegEnd > 0) {
          // Complete JPEG found
          const jpegData = imageData.slice(0, jpegEnd);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${vehicleId}_ch${channelId}_event${eventCode}_${timestamp}.jpg`;
          
          console.log(`✅ Complete JPEG: ${jpegData.length} bytes, channel ${channelId}, event ${eventCode}`);
          return { type: 'jpeg', data: jpegData, filename };
        } else {
          // Fragmented - need to buffer
          const key = `${vehicleId}_${multimediaId}`;
          const existing = this.fragmentBuffers.get(key);
          
          if (!existing) {
            this.fragmentBuffers.set(key, {
              id: multimediaId,
              vehicleId,
              fragments: [imageData],
              timestamp: new Date()
            });
            console.log(`📦 Fragment 1 buffered for ${key}`);
          } else {
            existing.fragments.push(imageData);
            console.log(`📦 Fragment ${existing.fragments.length} buffered for ${key}`);
            
            // Check if we have complete JPEG
            const combined = Buffer.concat(existing.fragments);
            let hasEnd = false;
            for (let i = combined.length - 2; i >= Math.max(0, combined.length - 100); i--) {
              if (combined[i] === 0xFF && combined[i + 1] === 0xD9) {
                hasEnd = true;
                break;
              }
            }
            
            if (hasEnd) {
              // Find exact end position
              let jpegEnd = combined.length;
              for (let i = combined.length - 2; i >= 0; i--) {
                if (combined[i] === 0xFF && combined[i + 1] === 0xD9) {
                  jpegEnd = i + 2;
                  break;
                }
              }
              
              const jpegData = combined.slice(0, jpegEnd);
              this.fragmentBuffers.delete(key);
              
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `${vehicleId}_ch${channelId}_event${eventCode}_${timestamp}.jpg`;
              
              console.log(`✅ Complete JPEG from ${existing.fragments.length} fragments: ${jpegData.length} bytes`);
              return { type: 'jpeg', data: jpegData, filename };
            }
          }
        }
      } else {
        console.warn(`⚠️ Invalid JPEG header: ${imageData[0]?.toString(16)} ${imageData[1]?.toString(16)}`);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing multimedia data:', error);
      return null;
    }
  }

  static async saveMultimediaFile(vehicleId: string, filename: string, data: Buffer, channel: number = 1): Promise<string> {
    // Validate JPEG before saving
    if (data.length < 2 || data[0] !== 0xFF || data[1] !== 0xD8) {
      throw new Error('Invalid JPEG: Missing start marker (FFD8)');
    }
    
    // Check for end marker
    let hasEnd = false;
    for (let i = data.length - 2; i >= Math.max(0, data.length - 100); i--) {
      if (data[i] === 0xFF && data[i + 1] === 0xD9) {
        hasEnd = true;
        break;
      }
    }
    
    if (!hasEnd) {
      throw new Error('Invalid JPEG: Missing end marker (FFD9)');
    }
    
    const mediaDir = path.join(process.cwd(), 'media', vehicleId);
    
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
    
    const filePath = path.join(mediaDir, filename);
    fs.writeFileSync(filePath, data);
    
    console.log(`💾 Saved valid JPEG: ${filePath} (${data.length} bytes)`);
    
    // Save to database
    try {
      await this.imageStorage.saveImageFromPath(vehicleId, channel, filePath, data.length);
    } catch (error) {
      console.error('Failed to save image to database:', error);
    }
    
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