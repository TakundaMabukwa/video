import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize bucket
export async function ensureBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    
    // Check if any bucket exists, use first one found
    if (buckets && buckets.length > 0) {
      console.log(`✅ Using existing bucket: ${buckets[0].name}`);
      return buckets[0].name;
    }
    
    // No buckets exist, create new one
    const bucketName = 'jtt1078-media';
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800 // 50MB (reduced from 500MB)
    });
    
    if (error) {
      console.warn('⚠️ Bucket creation warning:', error.message);
      // Don't throw - bucket might already exist
      return bucketName;
    }
    
    console.log(`✅ Created Supabase bucket: ${bucketName}`);
    return bucketName;
  } catch (error) {
    console.warn('⚠️ Supabase bucket initialization skipped:', error);
    return 'jtt1078-media'; // Return default bucket name
  }
}
