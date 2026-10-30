create table if not exists public.voice_capsules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'today' check (category in ('today', 'sleep', 'miss', 'blessing')),
  title text not null check (char_length(trim(title)) between 1 and 80),
  audio_path text not null,
  duration_seconds integer not null default 0 check (duration_seconds between 1 and 180),
  created_at timestamptz not null default now()
);

create index if not exists voice_capsules_couple_created_idx
  on public.voice_capsules(couple_id, created_at desc);

alter table public.voice_capsules enable row level security;

drop policy if exists "voice capsules read by couple" on public.voice_capsules;
create policy "voice capsules read by couple"
  on public.voice_capsules for select
  using (public.is_couple_member(couple_id));

drop policy if exists "voice capsules create by member" on public.voice_capsules;
create policy "voice capsules create by member"
  on public.voice_capsules for insert
  with check (public.is_couple_member(couple_id) and author_id = auth.uid());

drop policy if exists "voice capsules delete by author" on public.voice_capsules;
create policy "voice capsules delete by author"
  on public.voice_capsules for delete
  using (author_id = auth.uid() and public.is_couple_member(couple_id));

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'voice_capsules'
  ) then
    alter publication supabase_realtime add table public.voice_capsules;
  end if;
end $$;

-- Capsules reuse the private message-media bucket with a dedicated path.
drop policy if exists "voice capsules media read by couple" on storage.objects;
create policy "voice capsules media read by couple"
  on storage.objects for select
  using (
    bucket_id = 'message-media'
    and (storage.foldername(name))[2] = 'messages'
    and (storage.foldername(name))[3] = 'voice-capsules'
    and public.is_couple_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "voice capsules media upload by couple" on storage.objects;
create policy "voice capsules media upload by couple"
  on storage.objects for insert
  with check (
    bucket_id = 'message-media'
    and (storage.foldername(name))[2] = 'messages'
    and (storage.foldername(name))[3] = 'voice-capsules'
    and public.is_couple_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "voice capsules media delete by couple" on storage.objects;
create policy "voice capsules media delete by couple"
  on storage.objects for delete
  using (
    bucket_id = 'message-media'
    and (storage.foldername(name))[2] = 'messages'
    and (storage.foldername(name))[3] = 'voice-capsules'
    and public.is_couple_member((storage.foldername(name))[1]::uuid)
  );

notify pgrst, 'reload schema';
