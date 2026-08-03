create table if not exists public.couple_easter_eggs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  secret_hash text not null check (char_length(secret_hash) between 32 and 128),
  title text not null default '只属于我们的秘密' check (char_length(trim(title)) between 1 and 100),
  content text not null check (char_length(trim(content)) between 1 and 3000),
  media_path text,
  media_type text check (media_type is null or media_type in ('image', 'video')),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couple_easter_eggs enable row level security;

drop policy if exists "easter egg read by couple" on public.couple_easter_eggs;
create policy "easter egg read by couple"
  on public.couple_easter_eggs for select
  using (public.is_couple_member(couple_id));

drop policy if exists "easter egg create by couple" on public.couple_easter_eggs;
create policy "easter egg create by couple"
  on public.couple_easter_eggs for insert
  with check (public.is_couple_member(couple_id) and created_by = auth.uid());

drop policy if exists "easter egg update by couple" on public.couple_easter_eggs;
create policy "easter egg update by couple"
  on public.couple_easter_eggs for update
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

drop policy if exists "easter egg delete by creator" on public.couple_easter_eggs;
create policy "easter egg delete by creator"
  on public.couple_easter_eggs for delete
  using (created_by = auth.uid());

create or replace function public.touch_easter_egg_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_easter_egg_updated_at on public.couple_easter_eggs;
create trigger touch_easter_egg_updated_at
before update on public.couple_easter_eggs
for each row execute function public.touch_easter_egg_updated_at();

revoke all on function public.touch_easter_egg_updated_at() from public;
notify pgrst, 'reload schema';
