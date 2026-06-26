-- Run this in Supabase SQL Editor to update existing tables

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS apt_w numeric default 1500,
  ADD COLUMN IF NOT EXISTS apt_h numeric default 1200;

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS x_cm numeric default 0,
  ADD COLUMN IF NOT EXISTS y_cm numeric default 0,
  ADD COLUMN IF NOT EXISTS color text default 'blue';
