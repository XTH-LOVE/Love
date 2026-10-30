-- 028: 一起听房间状态持久化与私有 Realtime 授权
-- Realtime 用于即时播放控制；此表用于刷新、断线和迟到加入时恢复房间快照。

create table if not exists public.listening_sessions (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  track jsonb,
  position double precision not null default 0 check (position >= 0),
  playing boolean not null default false,
  queue jsonb not null default '[]'::jsonb check (jsonb_typeof(queue) = 'array'),
  revision bigint not null default 0 check (revision >= 0),
  updated_by uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.listening_sessions enable row level security;

drop policy if exists "listening sessions read by couple" on public.listening_sessions;
create policy "listening sessions read by couple"
  on public.listening_sessions for select
  using (public.is_couple_member(couple_id));

drop policy if exists "listening sessions insert by member" on public.listening_sessions;
create policy "listening sessions insert by member"
  on public.listening_sessions for insert
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

drop policy if exists "listening sessions update by member" on public.listening_sessions;
create policy "listening sessions update by member"
  on public.listening_sessions for update
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id) and updated_by = auth.uid());

-- 只接受更高版本，避免网络延迟导致旧状态覆盖新状态。
create or replace function public.save_listening_session(
  p_couple_id uuid,
  p_track jsonb,
  p_position double precision,
  p_playing boolean,
  p_queue jsonb,
  p_revision bigint
)
returns public.listening_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.listening_sessions;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception '无权更新此情侣空间';
  end if;
  if p_position < 0 or p_revision < 0 or jsonb_typeof(p_queue) <> 'array' then
    raise exception '一起听状态参数无效';
  end if;

  insert into public.listening_sessions(couple_id, track, position, playing, queue, revision, updated_by)
  values (p_couple_id, p_track, p_position, p_playing, p_queue, p_revision, auth.uid())
  on conflict (couple_id) do update set
    track = excluded.track,
    position = excluded.position,
    playing = excluded.playing,
    queue = excluded.queue,
    revision = excluded.revision,
    updated_by = excluded.updated_by,
    updated_at = now()
  where public.listening_sessions.revision < excluded.revision
  returning * into saved;

  if saved.couple_id is null then
    select * into saved from public.listening_sessions where couple_id = p_couple_id;
  end if;
  return saved;
end;
$$;

grant execute on function public.save_listening_session(uuid, jsonb, double precision, boolean, jsonb, bigint) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.listening_sessions;
exception when duplicate_object then null; end $$;

-- 私有频道：只有当前情侣空间成员可以读写 listen-together:<couple_id>。
drop policy if exists "listen together receive by couple" on realtime.messages;
create policy "listen together receive by couple"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() ~ '^listen-together:[0-9a-f-]{36}$'
    and public.is_couple_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

drop policy if exists "listen together publish by couple" on realtime.messages;
create policy "listen together publish by couple"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() ~ '^listen-together:[0-9a-f-]{36}$'
    and public.is_couple_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

notify pgrst, 'reload schema';
