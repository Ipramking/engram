-- Engram 2.4: better recall. Full-text search (stems, prefixes) plus fuzzy matching (typos),
-- ranked in the database over all of a user's memories instead of the newest few hundred.
-- Safe to run more than once. Run in the Supabase SQL editor.

-- Supabase keeps extensions in the "extensions" schema.
create extension if not exists pg_trgm with schema extensions;

alter table public.memories_meta
  add column if not exists search tsvector
  generated always as (to_tsvector('english'::regconfig, coalesce(type, '') || ' ' || coalesce(text, ''))) stored;

create index if not exists idx_memories_meta_search on public.memories_meta using gin (search);
create index if not exists idx_memories_meta_text_trgm on public.memories_meta using gin (text extensions.gin_trgm_ops);

-- p_terms: plain lowercase words (the server removes filler words and may add related terms).
-- A memory matches if it contains any term (as a word or word prefix) or fuzzily matches the query.
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
     and (m.room is null or m.room not like 'superseded_by:%')
     and ((tq.tsq is not null and m.search @@ tq.tsq) or word_similarity(p_query, m.text) > 0.45)
   order by rank desc, m.created_at desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.search_memories(uuid, uuid, text, text[], int) from public, anon, authenticated;
grant execute on function public.search_memories(uuid, uuid, text, text[], int) to service_role;
