-- 전체 초기화 후 새로 생성 (기존 데이터 삭제됨)

drop table if exists furniture_items cascade;
drop table if exists rooms cascade;
drop table if exists projects cascade;

create extension if not exists "pgcrypto";

-- 프로젝트 테이블
create table projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '우리 집 배치도',
  share_code text unique not null default substring(md5(random()::text), 1, 8),
  apt_w      numeric not null default 1500,
  apt_h      numeric not null default 1200,
  created_at timestamptz default now()
);

-- 방/공간 테이블
create table rooms (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade not null,
  name        text not null,
  width_cm    numeric not null default 400,
  height_cm   numeric not null default 300,
  x_cm        numeric not null default 0,
  y_cm        numeric not null default 0,
  color       text not null default 'blue',
  order_index integer not null default 0,
  created_at  timestamptz default now()
);

-- RLS 활성화
alter table projects enable row level security;
alter table rooms enable row level security;

-- 공개 접근 허용 (URL 공유 방식)
create policy "Public access projects" on projects for all using (true) with check (true);
create policy "Public access rooms"    on rooms    for all using (true) with check (true);

-- 실시간 활성화
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table rooms;
