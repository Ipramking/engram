-- ==============================================================================
-- Engram Database Schema for Supabase
-- Covers: Profiles, Teams, Team Members, API Keys, Daily Usage, and Memory Meta
-- All tables are created first before policies to prevent forward-reference errors.
-- ==============================================================================

-- ── 1. Create All Tables First ──────────────────────────────────────────────

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  plan_tier text not null default 'free_personal',
  created_at timestamptz not null default now()
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_tier text not null default 'free_team',
  created_at timestamptz not null default now()
);

-- Team Members (Strict max 3 members enforced on Free Team plan)
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'pending')),
  joined_at timestamptz not null default now()
);
create unique index if not exists idx_team_members_unique on public.team_members(team_id, email);

-- API Keys / Space Tokens
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scope text not null check (scope in ('personal', 'team')),
  room text not null default 'my-space',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_api_keys_hash on public.api_keys(key_hash);
create index if not exists idx_api_keys_user on public.api_keys(user_id);

-- Daily Usage & Quotas (50 saves/day personal, 150 saves/day team)
create table if not exists public.usage_daily (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user', 'team')),
  entity_id text not null,
  date text not null, -- 'YYYY-MM-DD'
  saves_count int not null default 0,
  recalls_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_usage_entity_date on public.usage_daily(entity_type, entity_id, date);

-- Memories Metadata Cache (for fast in-app dashboard search and curation)
create table if not exists public.memories_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  room text not null default 'my-space',
  type text not null,
  text text not null,
  blob_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_memories_user on public.memories_meta(user_id);
create index if not exists idx_memories_team on public.memories_meta(team_id);


-- ── 2. Helper Functions & Triggers ──────────────────────────────────────────

-- Trigger to auto-create profile on auth.user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, plan_tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'free_personal'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Security definer helper to check team membership without circular RLS recursion
create or replace function public.is_team_member(lookup_team_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.team_members
    where team_id = lookup_team_id and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;


-- ── 3. Row Level Security (RLS) Policies ────────────────────────────────────

-- Profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Teams
alter table public.teams enable row level security;
drop policy if exists "Team members can view their teams" on public.teams;
create policy "Team members can view their teams" on public.teams
  for select using (
    owner_id = auth.uid() or public.is_team_member(id)
  );

drop policy if exists "Owners can update their teams" on public.teams;
create policy "Owners can update their teams" on public.teams
  for update using (owner_id = auth.uid());

-- Team Members
alter table public.team_members enable row level security;
drop policy if exists "Members can view teammate roster" on public.team_members;
create policy "Members can view teammate roster" on public.team_members
  for select using (
    user_id = auth.uid() or public.is_team_member(team_id) or exists (
      select 1 from public.teams t where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- API Keys
alter table public.api_keys enable row level security;
drop policy if exists "Users can view and manage their API keys" on public.api_keys;
create policy "Users can view and manage their API keys" on public.api_keys
  for all using (user_id = auth.uid());

-- Usage Daily
alter table public.usage_daily enable row level security;
drop policy if exists "Users can view their usage" on public.usage_daily;
create policy "Users can view their usage" on public.usage_daily
  for select using (
    (entity_type = 'user' and entity_id = auth.uid()::text) or
    (entity_type = 'team' and exists (
      select 1 from public.team_members
      where team_members.team_id::text = usage_daily.entity_id
      and team_members.user_id = auth.uid()
    ))
  );

-- Memories Meta
alter table public.memories_meta enable row level security;
drop policy if exists "Users can view their memories" on public.memories_meta;
create policy "Users can view their memories" on public.memories_meta
  for select using (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );
