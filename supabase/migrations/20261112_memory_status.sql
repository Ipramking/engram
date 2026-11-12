-- Engram 2.5: a real "replaced" status for memories (it used to live as a "superseded_by:<id>"
-- marker in the room column), plus recall that respects it.
-- Run after 20261106_recall_search.sql. Safe to run more than once. Run in the Supabase SQL editor.
-- The app works before and after this runs: it reads both the new columns and the old marker.

alter table public.memories_meta add column if not exists superseded_by text;
alter table public.memories_meta add column if not exists superseded_at timestamptz;

-- Copy existing markers into the new columns. The room markers stay, so an older deployment
-- still sees the same state.
update public.memories_meta
   set superseded_by = coalesce(nullif(substr(room, 15), ''), 'unknown'),
       superseded_at = coalesce(superseded_at, now())
 where superseded_by is null
   and room like 'superseded_by:%';

-- Active (not replaced) memories are what recall and the dashboard read most.
create index if not exists idx_memories_meta_active_personal
  on public.memories_meta (user_id, created_at desc) where team_id is null and superseded_by is null;
create index if not exists idx_memories_meta_active_team
  on public.memories_meta (team_id, created_at desc) where superseded_by is null;

-- Same search as 2.4 (full text with prefixes + fuzzy matching), now also skipping memories
-- marked replaced in the new column.
create or replace function public.search_memories(
  p_user uuid,
  p_team uuid,
  p_query text,
  p_terms text[],
  p_limit int default 10
)
returns table (id uuid, type text, text text, blob_id text, created_at timestamptz, room text, team_id uuid, rank real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with q as (
    select nullif(
      array_to_string(array(select t || ':*' from unnest(coalesce(p_terms, '{}')) as t where t ~ '^[a-z0-9]{2,40}$'), ' | '),
      ''
    ) as expr
  ), tq as (
    select case when expr is null then null else to_tsquery('english', expr) end as tsq from q
  )
  select m.id, m.type, m.text, m.blob_id, m.created_at, m.room, m.team_id,
         (coalesce(ts_rank_cd(m.search, tq.tsq, 32), 0) + word_similarity(p_query, m.text) * 0.5)::real as rank
    from public.memories_meta m, tq
   where (case when p_team is not null then m.team_id = p_team else m.user_id = p_user and m.team_id is null end)
     and m.superseded_by is null
     and (m.room is null or m.room not like 'superseded_by:%')
     and ((tq.tsq is not null and m.search @@ tq.tsq) or word_similarity(p_query, m.text) > 0.45)
   order by rank desc, m.created_at desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.search_memories(uuid, uuid, text, text[], int) from public, anon, authenticated;
grant execute on function public.search_memories(uuid, uuid, text, text[], int) to service_role;

-- Ask PostgREST to pick up the new columns straight away.
notify pgrst, 'reload schema';
