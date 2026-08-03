create table if not exists public.story_share_links (
  token uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists story_share_links_couple_idx
  on public.story_share_links(couple_id, created_at desc);

alter table public.story_share_links enable row level security;

drop policy if exists "story share links read by couple" on public.story_share_links;
create policy "story share links read by couple"
  on public.story_share_links for select
  using (public.is_couple_member(couple_id));

drop policy if exists "story share links create by couple" on public.story_share_links;
create policy "story share links create by couple"
  on public.story_share_links for insert
  with check (public.is_couple_member(couple_id) and created_by = auth.uid());

drop policy if exists "story share links revoke by creator" on public.story_share_links;
create policy "story share links revoke by creator"
  on public.story_share_links for update
  using (public.is_couple_member(couple_id) and created_by = auth.uid())
  with check (public.is_couple_member(couple_id) and created_by = auth.uid());

notify pgrst, 'reload schema';
