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
      
      // Check if JPEG data starts at byte 8
      if (body.length >= 10 && body[8] === 0xFF && body[9] === 0xD8) {
        const key = `${vehicleId}_${multimediaId}`;
        const existing = this.fragmentBuffers.get(key);
        
        if (!existing) {
          this.fragmentBuffers.set(key, {
            id: multimediaId,
            vehicleId,
            fragments: [body.slice(8)],
            timestamp: new Date()
          });
          return null;
        }
      }
      
      // Check continuation fragment
      const key = `${vehicleId}_${multimediaId}`;
      const existing = this.fragmentBuffers.get(key);
      
      if (existing) {
        existing.fragments.push(body.slice(8));
        
        // Check for JPEG end
        const lastFragment = body.slice(8);
        let hasEnd = false;
        for (let i = lastFragment.length - 2; i >= Math.max(0, lastFragment.length - 100); i--) {
          if (lastFragment[i] === 0xFF && lastFragment[i + 1] === 0xD9) {
            hasEnd = true;
            break;
          }
        }
        
        if (hasEnd) {
          const fullData = Buffer.concat(existing.fragments);
          this.fragmentBuffers.delete(key);
          
          let jpegEnd = fullData.length;
          for (let i = fullData.length - 2; i >= 0; i--) {
            if (fullData[i] === 0xFF && fullData[i + 1] === 0xD9) {
              jpegEnd = i + 2;
              break;
            }
          }
          
          const jpegData = fullData.slice(0, jpegEnd);
          console.log(`\u2705 JPEG: ${existing.fragments.length} fragments, ${jpegData.length} bytes`);
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${vehicleId}_${timestamp}.jpg`;
          
          return { type: 'jpeg', data: jpegData, filename };
        }
        
        return null;
      }
      
      return null;
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