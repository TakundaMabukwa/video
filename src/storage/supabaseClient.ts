import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);

export class SupabaseStorage {
  static async uploadImage(vehicleId: string, filename: string, imageData: Buffer): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('vehicle-images')
        .upload(`${vehicleId}/${filename}`, imageData, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('vehicle-images')
        .getPublicUrl(`${vehicleId}/${filename}`);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload to Supabase:', error);
      return null;
    }
  }

  static async createBucket(): Promise<boolean> {
    try {
      const { error } = await supabase.storage.createBucket('vehicle-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'video/mp4'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (error && error.message !== 'Bucket already exists') {
        console.error('Failed to create bucket:', error);
        return false;
      }

      console.log('✅ Supabase bucket ready: vehicle-images');
      return true;
    } catch (error) {
      console.error('Bucket creation error:', error);
      return false;
    }
  }
}