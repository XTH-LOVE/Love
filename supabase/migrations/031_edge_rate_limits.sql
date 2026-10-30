create table if not exists public.edge_rate_limits (
  rate_key text primary key check (char_length(rate_key) between 1 and 300),
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);

revoke all on table public.edge_rate_limits from anon, authenticated;
alter table public.edge_rate_limits enable row level security;

create or replace function public.consume_edge_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_attempts integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_attempt integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 300
    or p_window_seconds <= 0 or p_max_attempts <= 0 then
    raise exception '限流参数无效';
  end if;

  insert into public.edge_rate_limits(rate_key, window_started_at, attempt_count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (rate_key) do update set
    window_started_at = case
      when now() - public.edge_rate_limits.window_started_at >= make_interval(secs => p_window_seconds)
      then now()
      else public.edge_rate_limits.window_started_at
    end,
    attempt_count = case
      when now() - public.edge_rate_limits.window_started_at >= make_interval(secs => p_window_seconds)
      then 1
      else public.edge_rate_limits.attempt_count + 1
    end,
    updated_at = now()
  returning attempt_count into next_attempt;

  return next_attempt <= p_max_attempts;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
