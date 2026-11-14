-- Engram 2.5: rate limits shared by every serverless instance (sign-up, sign-in, CLI login,
-- OAuth client registration). Keys arrive already hashed, so no emails or IPs are stored.
-- Safe to run more than once. Run in the Supabase SQL editor.

create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

-- No policies: only the service role (which bypasses RLS) can touch this table.
alter table public.rate_limits enable row level security;

-- One atomic hit: starts a new window when the old one has ended. Returns true while the caller
-- is within p_limit hits for the current window.
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when r.reset_at < now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at < now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning count into v_count;

  -- Now and then, clear windows that ended more than a day ago.
  if random() < 0.01 then
    delete from public.rate_limits where reset_at < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

notify pgrst, 'reload schema';
