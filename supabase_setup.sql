-- ============================================
-- FlowRich Supabase 資料表建立 SQL
-- 請到 Supabase Dashboard > SQL Editor 貴上執行
-- ============================================

-- 1. 建立 user_data 表：每位使用者一筆 JSON 資料
create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. 啟用 Row Level Security (RLS)
alter table public.user_data enable row level security;

-- 3. RLS 政策：使用者只能存取自己的資料
create policy "Users can read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. 自動更新 updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_user_data_updated
  before update on public.user_data
  for each row execute function public.handle_updated_at();
