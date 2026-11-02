-- ==============================================================================
-- Engram 2.1 — Production Reliability, Continuity, and Security Hardening
-- Migration: 20261102_engram_2_1_hardening.sql
-- Covers:
-- 1. continuity_contexts (durable project context, architecture, tasks)
-- 2. continuity_handoffs (cross-agent handoff log with verified actor IDs)
-- 3. continuity_snapshots (verifiable canonical snapshots with full checksum)
-- 4. storage_recovery_jobs (durable write-ahead retry queue with worker leases)
-- ==============================================================================

-- ── 1. Continuity Contexts ──────────────────────────────────────────────────
create table if not exists public.continuity_contexts (
  id text primary key, -- e.g. 'proj_abc123'
  slug text not null,
  name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'team')),
  architecture jsonb not null default '{}'::jsonb,
  active_tasks jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '[]'::jsonb,
  key_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_continuity_contexts_user on public.continuity_contexts(user_id);
create index if not exists idx_continuity_contexts_team on public.continuity_contexts(team_id);
create index if not exists idx_continuity_contexts_scope on public.continuity_contexts(scope);

-- ── 2. Continuity Handoffs ──────────────────────────────────────────────────
create table if not exists public.continuity_handoffs (
  id text primary key, -- e.g. 'handoff_abc123'
  project_id text not null references public.continuity_contexts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  from_agent text not null,
  to_agent text not null,
  task_state text not null default 'in_progress',
  handoff_notes text not null,
  supporting_references jsonb not null default '[]'::jsonb,
  unresolved_questions jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_continuity_handoffs_project on public.continuity_handoffs(project_id);
create index if not exists idx_continuity_handoffs_user on public.continuity_handoffs(user_id);
create index if not exists idx_continuity_handoffs_created on public.continuity_handoffs(created_at desc);

-- ── 3. Continuity Snapshots ────────────────────────────────────────────────
create table if not exists public.continuity_snapshots (
  id text primary key, -- e.g. 'snap_abc123'
  project_id text not null references public.continuity_contexts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  project_name text not null,
  schema_version text not null default '2.0',
  checksum text not null,
  context_payload jsonb not null,
  latest_handoff_payload jsonb,
  active_memories_count int not null default 0,
  active_memories_sample jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_continuity_snapshots_project on public.continuity_snapshots(project_id);
create index if not exists idx_continuity_snapshots_user on public.continuity_snapshots(user_id);
create index if not exists idx_continuity_snapshots_checksum on public.continuity_snapshots(checksum);

-- ── 4. Storage Recovery Jobs (Durable Retry Queue) ──────────────────────────
create table if not exists public.storage_recovery_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'team')),
  type text not null,
  text text not null,
  content_hash text not null,
  idempotency_key text not null,
  encoded_text text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  status text not null default 'pending' check (status in ('pending', 'leased', 'completed', 'failed', 'dead_letter')),
  lease_id text,
  leased_until timestamptz,
  next_retry_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recovery_jobs_status_retry on public.storage_recovery_jobs(status, next_retry_at);
create index if not exists idx_recovery_jobs_idempotency on public.storage_recovery_jobs(idempotency_key);
create index if not exists idx_recovery_jobs_user on public.storage_recovery_jobs(user_id);

-- ── 5. Row-Level Security (RLS) Policies ────────────────────────────────────

-- Continuity Contexts RLS
alter table public.continuity_contexts enable row level security;
drop policy if exists "Users and teammates can view continuity contexts" on public.continuity_contexts;
create policy "Users and teammates can view continuity contexts" on public.continuity_contexts
  for select using (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Users and teammates can insert continuity contexts" on public.continuity_contexts;
create policy "Users and teammates can insert continuity contexts" on public.continuity_contexts
  for insert with check (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Users and teammates can update continuity contexts" on public.continuity_contexts;
create policy "Users and teammates can update continuity contexts" on public.continuity_contexts
  for update using (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Users can delete own continuity contexts" on public.continuity_contexts;
create policy "Users can delete own continuity contexts" on public.continuity_contexts
  for delete using (
    user_id = auth.uid() or
    (team_id is not null and exists (
      select 1 from public.teams t where t.id = continuity_contexts.team_id and t.owner_id = auth.uid()
    ))
  );

-- Continuity Handoffs RLS
alter table public.continuity_handoffs enable row level security;
drop policy if exists "Users and teammates can view continuity handoffs" on public.continuity_handoffs;
create policy "Users and teammates can view continuity handoffs" on public.continuity_handoffs
  for select using (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Users and teammates can insert continuity handoffs" on public.continuity_handoffs;
create policy "Users and teammates can insert continuity handoffs" on public.continuity_handoffs
  for insert with check (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

-- Continuity Snapshots RLS
alter table public.continuity_snapshots enable row level security;
drop policy if exists "Users and teammates can view continuity snapshots" on public.continuity_snapshots;
create policy "Users and teammates can view continuity snapshots" on public.continuity_snapshots
  for select using (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

drop policy if exists "Users and teammates can insert continuity snapshots" on public.continuity_snapshots;
create policy "Users and teammates can insert continuity snapshots" on public.continuity_snapshots
  for insert with check (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );

-- Storage Recovery Jobs RLS
alter table public.storage_recovery_jobs enable row level security;
drop policy if exists "Users and teammates can view recovery jobs" on public.storage_recovery_jobs;
create policy "Users and teammates can view recovery jobs" on public.storage_recovery_jobs
  for select using (
    user_id = auth.uid() or
    (team_id is not null and public.is_team_member(team_id))
  );
