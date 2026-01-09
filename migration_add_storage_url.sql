-- Add storage_url column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS storage_url TEXT;
