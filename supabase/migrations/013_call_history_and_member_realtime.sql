-- Shared call history and real-time member profile refreshes.
create table if not exists public.call_records (
  id uuid primary key default gen_random_uuid(),
  call_id text not null unique,
  couple_id uuid not null references public.couples(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  call_mode text not null check (call_mode in ('audio', 'video')),
  status text not null default 'calling' check (status in ('calling', 'connected', 'completed', 'cancelled', 'declined')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0)
);

create index if not exists call_records_couple_started_at_idx on public.call_records(couple_id, started_at desc);

alter table public.call_records enable row level security;
drop policy if exists "call records read by couple" on public.call_records;
drop policy if exists "call records create by caller" on public.call_records;
drop policy if exists "call records update by caller" on public.call_records;
create policy "call records read by couple" on public.call_records for select using (public.is_couple_member(couple_id));
create policy "call records create by caller" on public.call_records for insert with check (caller_id = auth.uid() and public.is_couple_member(couple_id));
create policy "call records update by caller" on public.call_records for update using (caller_id = auth.uid()) with check (caller_id = auth.uid() and public.is_couple_member(couple_id));

create or replace function public.guard_call_record_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.call_id is distinct from old.call_id
    or new.couple_id is distinct from old.couple_id
    or new.caller_id is distinct from old.caller_id
    or new.call_mode is distinct from old.call_mode
    or new.started_at is distinct from old.started_at then
    raise exception '通话记录的归属和开始时间不可修改';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_call_record_update on public.call_records;
create trigger guard_call_record_update before update on public.call_records for each row execute function public.guard_call_record_update();

-- Couple members need to receive their partner's profile row in Realtime.
drop policy if exists "profiles read couple" on public.profiles;
create policy "profiles read couple" on public.profiles for select using (id = auth.uid() or public.is_same_couple_user(id));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_records') then
    alter publication supabase_realtime add table public.call_records;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
