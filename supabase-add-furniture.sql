-- Run this in Supabase SQL Editor
-- 가구 배치를 방마다 저장 → 실시간 공유
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS furniture JSONB DEFAULT '[]'::jsonb;
