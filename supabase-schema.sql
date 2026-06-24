-- Supabase SQL Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Projects table
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 집',
  share_code text unique not null default substring(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

-- Rooms table
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  width_cm numeric not null default 400,
  height_cm numeric not null default 300,
  order_index integer not null default 0,
  created_at timestamptz default now()
);

-- Furniture items table
create table if not exists furniture_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  type text not null,
  label text not null,
  x numeric not null default 0,
  y numeric not null default 0,
  width_cm numeric not null,
  height_cm numeric not null,
  rotation integer not null default 0,
  color text not null default '#94a3b8',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger furniture_items_updated_at
  before update on furniture_items
  for each row execute function update_updated_at();

-- Enable Row Level Security (public access for shared projects)
alter table projects enable row level security;
alter table rooms enable row level security;
alter table furniture_items enable row level security;

-- Allow public read/write (share via URL - no auth needed)
create policy "Public access projects" on projects for all using (true) with check (true);
create policy "Public access rooms" on rooms for all using (true) with check (true);
create policy "Public access furniture_items" on furniture_items for all using (true) with check (true);

-- Enable Realtime for furniture_items and rooms
alter publication supabase_realtime add table furniture_items;
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table projects;
