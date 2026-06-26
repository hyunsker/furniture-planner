-- Run this in Supabase SQL Editor
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS shape_data JSONB DEFAULT '{"type":"rect"}'::jsonb;
