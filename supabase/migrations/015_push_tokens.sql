-- Device push tokens used for background incoming-call notifications.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  platform text not null check (platform in ('android', 'web')),
  token text not null unique,
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_couple_platform_idx on public.push_tokens(couple_id, platform);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;
drop policy if exists "push tokens read by couple" on public.push_tokens;
drop policy if exists "push tokens insert own" on public.push_tokens;
drop policy if exists "push tokens update own" on public.push_tokens;
drop policy if exists "push tokens delete own" on public.push_tokens;
create policy "push tokens read by couple" on public.push_tokens for select using (public.is_couple_member(couple_id));
create policy "push tokens insert own" on public.push_tokens for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "push tokens update own" on public.push_tokens for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "push tokens delete own" on public.push_tokens for delete using (user_id = auth.uid());

create or replace function public.touch_push_token_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.last_seen_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_touch_updated_at on public.push_tokens;
create trigger push_tokens_touch_updated_at before update on public.push_tokens for each row execute function public.touch_push_token_updated_at();
