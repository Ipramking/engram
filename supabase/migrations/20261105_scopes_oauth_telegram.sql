-- Engram 2.3: plan-tier lock, scoped keys, "Sign in with Engram" (OAuth 2.1) and the Telegram bot.
-- Safe to run more than once. Run in the Supabase SQL editor.

-- ── 1. Users can no longer change their own plan ──────────────────────────
-- The old policy let a signed-in user UPDATE any column of their profile, including plan_tier.
-- Column privileges limit browser clients to the name; the server (service role) is unaffected.
revoke update on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

-- Team membership only counts while active.
create or replace function public.is_team_member(lookup_team_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.team_members
    where team_id = lookup_team_id and user_id = auth.uid() and status = 'active'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ── 2. Scoped keys ────────────────────────────────────────────────────────
-- read_write: full access (default, matches existing keys)
-- read: recall/list only (recall links, memory packs)
-- save: write only (share sheet, shortcuts, save links)
alter table public.api_keys
  add column if not exists permissions text not null default 'read_write';
do $$ begin
  alter table public.api_keys
    add constraint api_keys_permissions_check check (permissions in ('read_write', 'read', 'save'));
exception when duplicate_object then null; end $$;

-- ── 3. Sign in with Engram (OAuth 2.1 for MCP connectors) ─────────────────
-- Clients register themselves (dynamic client registration), users approve on the dashboard,
-- and each approval becomes one revocable API key. Codes and refresh tokens are stored hashed.
create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text,
  used boolean not null default false,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_refresh_tokens (
  token_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_oauth_refresh_key on public.oauth_refresh_tokens (api_key_id);

-- ── 4. Telegram bot ───────────────────────────────────────────────────────
-- A chat is linked to an account after the user approves its one-time code on the dashboard.
create table if not exists public.telegram_links (
  chat_id bigint primary key,
  user_id uuid references auth.users(id) on delete cascade,
  link_code text unique,
  link_expires_at timestamptz,
  linked_at timestamptz,
  default_type text not null default 'decision',
  created_at timestamptz not null default now()
);

-- Service role only: no policies, so browser clients can't read or write these tables.
alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_refresh_tokens enable row level security;
alter table public.telegram_links enable row level security;
