-- =============================================================
-- 027: 听歌房聊天（一起听页面的文字 / 语音消息）
-- =============================================================

create table if not exists public.music_room_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'audio')),
  content text,
  audio_path text,
  audio_duration integer,
  created_at timestamptz not null default now(),
  check (
    (kind = 'text' and content is not null and btrim(content) <> '')
    or (kind = 'audio' and audio_path is not null)
  )
);

create index if not exists music_room_messages_couple_idx
  on public.music_room_messages(couple_id, created_at desc);

alter table public.music_room_messages enable row level security;

drop policy if exists "music room messages read by couple" on public.music_room_messages;
create policy "music room messages read by couple"
  on public.music_room_messages for select
  using (public.is_couple_member(couple_id));

drop policy if exists "music room messages insert own" on public.music_room_messages;
create policy "music room messages insert own"
  on public.music_room_messages for insert
  with check (public.is_couple_member(couple_id) and sender_id = auth.uid());

drop policy if exists "music room messages delete own" on public.music_room_messages;
create policy "music room messages delete own"
  on public.music_room_messages for delete
  using (sender_id = auth.uid());

-- Realtime（幂等：已加入则忽略 42710 重复错误）
do $$ begin
  alter publication supabase_realtime add table public.music_room_messages;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
