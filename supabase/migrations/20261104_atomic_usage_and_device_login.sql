-- Engram 2.2: atomic daily quota + CLI device login.
-- Safe to run more than once. Run in the Supabase SQL editor (or `supabase db push`).

-- ── 1. Atomic usage increment ──────────────────────────────────────────────
-- Replaces read-then-upsert, which let concurrent saves slip past the daily limit.
-- Returns the new counts and whether the increment was allowed.
create or replace function public.increment_usage(
  p_entity_type text,
  p_entity_id text,
  p_date text,
  p_saves int,
  p_recalls int,
  p_save_limit int
)
returns table (saves_count int, recalls_count int, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  insert into public.usage_daily (entity_type, entity_id, date, saves_count, recalls_count)
  values (p_entity_type, p_entity_id, p_date, 0, 0)
  on conflict (entity_type, entity_id, date) do nothing;

  -- The row lock taken by UPDATE serialises concurrent callers, so the limit check is exact.
  return query
    with upd as (
      update public.usage_daily u
         set saves_count = u.saves_count + p_saves,
             recalls_count = u.recalls_count + p_recalls
       where u.entity_type = p_entity_type
         and u.entity_id = p_entity_id
         and u.date = p_date
         and (p_saves = 0 or u.saves_count + p_saves <= p_save_limit)
      returning u.saves_count, u.recalls_count
    )
    select upd.saves_count, upd.recalls_count, true from upd;

  if not found then
    return query
      select u.saves_count, u.recalls_count, false
        from public.usage_daily u
       where u.entity_type = p_entity_type and u.entity_id = p_entity_id and u.date = p_date;
  end if;
end;
$$;

revoke all on function public.increment_usage(text, text, text, int, int, int) from public, anon, authenticated;
grant execute on function public.increment_usage(text, text, text, int, int, int) to service_role;

-- ── 2. CLI device login ────────────────────────────────────────────────────
-- `engram-walrus login` shows a code, the signed-in user approves it in the dashboard,
-- and the server hands the CLI a permanent key encrypted to the CLI's one-time public key.
-- The database never holds a usable key: only RSA-OAEP ciphertext, cleared once collected.
create table if not exists public.device_logins (
  code text primary key,
  poll_hash text not null unique,
  public_key text not null,
  device_name text,
  user_id uuid references auth.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  encrypted_key text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'collected', 'denied')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
create index if not exists idx_device_logins_expires on public.device_logins (expires_at);

-- Service role only: no policies means anon/authenticated clients can't touch it.
alter table public.device_logins enable row level security;

-- Index the recall query path (scope filter + newest first).
create index if not exists idx_memories_meta_user_team_created
  on public.memories_meta (user_id, team_id, created_at desc);
create index if not exists idx_memories_meta_team_created
  on public.memories_meta (team_id, created_at desc);
