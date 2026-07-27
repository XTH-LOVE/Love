-- Media polish: durable video posters plus lightweight reactions for shared memories.
alter table public.album_photos add column if not exists video_poster_path text;
comment on column public.album_photos.video_poster_path is 'Generated JPEG poster for video grid previews';

create table if not exists public.memory_favorites (
  memory_id uuid not null references public.memories(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id)
);
create table if not exists public.memory_reactions (
  memory_id uuid not null references public.memories(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (memory_id, user_id, emoji)
);
create table if not exists public.memory_comments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 240),
  created_at timestamptz not null default now()
);
create index if not exists memory_comments_memory_idx on public.memory_comments(memory_id, created_at desc);

alter table public.memory_favorites enable row level security;
alter table public.memory_reactions enable row level security;
alter table public.memory_comments enable row level security;
drop policy if exists "memory favorites read by couple" on public.memory_favorites;
drop policy if exists "memory favorites write by member" on public.memory_favorites;
create policy "memory favorites read by couple" on public.memory_favorites for select using (public.is_couple_member(couple_id));
create policy "memory favorites write by member" on public.memory_favorites for all using (user_id = auth.uid() and public.is_couple_member(couple_id)) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
drop policy if exists "memory reactions read by couple" on public.memory_reactions;
drop policy if exists "memory reactions write by member" on public.memory_reactions;
create policy "memory reactions read by couple" on public.memory_reactions for select using (public.is_couple_member(couple_id));
create policy "memory reactions write by member" on public.memory_reactions for all using (user_id = auth.uid() and public.is_couple_member(couple_id)) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
drop policy if exists "memory comments read by couple" on public.memory_comments;
drop policy if exists "memory comments write by member" on public.memory_comments;
create policy "memory comments read by couple" on public.memory_comments for select using (public.is_couple_member(couple_id));
create policy "memory comments write by member" on public.memory_comments for all using (user_id = auth.uid() and public.is_couple_member(couple_id)) with check (user_id = auth.uid() and public.is_couple_member(couple_id));
