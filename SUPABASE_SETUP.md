# Supabase Storage Setup

## 1. Create Storage Bucket

1. Go to https://supabase.com/dashboard
2. Select your project: `kxtykpuxlsvrwcaumuqm`
3. Click **Storage** in sidebar
4. Click **New bucket**
5. Name: `videos`
6. **Public bucket**: ✅ YES (so images are accessible via URL)
7. Click **Create bucket**

## 2. Set Bucket Policies

Go to **Storage** → **Policies** → **videos** bucket:

### Allow Public Read:
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'videos' );
```

### Allow Service Role Upload:
```sql
CREATE POLICY "Service Role Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'videos' 
  AND auth.role() = 'service_role'
);
```

## 3. Folder Structure

Images will be organized as:
```
videos/
├── 123456789012/
│   ├── ch1/
│   │   ├── 2024-01-15T10-30-00.jpg
│   │   └── 2024-01-15T10-35-00.jpg
│   └── ch2/
│       └── 2024-01-15T10-30-00.jpg
└── 987654321098/
    └── ch1/
        └── 2024-01-15T11-00-00.jpg
```

## 4. Test Upload

```bash
# Start server
npm run dev

# Request screenshot
curl -X POST http://localhost:3000/api/vehicles/123456789012/screenshot

# Check logs for:
# "📸 Image uploaded: https://kxtykpuxlsvrwcaumuqm.supabase.co/storage/v1/object/public/videos/..."
```

## 5. Access Images

Images are accessible via public URL:
```
https://kxtykpuxlsvrwcaumuqm.supabase.co/storage/v1/object/public/videos/123456789012/ch1/2024-01-15T10-30-00.jpg
```

## 6. Storage Limits

- **Free tier**: 1 GB
- **Pro tier**: 100 GB ($25/month)
- **Bandwidth**: 2 GB/month (free), then $0.09/GB

Monitor usage at: **Storage** → **Usage**

## 7. Cleanup Old Images (Optional)

Set up lifecycle policy to delete images older than 30 days:

```sql
-- Run this periodically
DELETE FROM storage.objects
WHERE bucket_id = 'videos'
AND created_at < NOW() - INTERVAL '30 days';
```

## Done!

Images now upload to Supabase automatically and are accessible worldwide via CDN.
