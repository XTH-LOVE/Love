-- Shared calendar expansion: recurrence, reminders, tasks, and memory links.
alter table public.shared_events
  add column if not exists repeat_rule text not null default 'none'
    check (repeat_rule in ('none','daily','weekly','monthly','yearly','weekdays')),
  add column if not exists repeat_until date,
  add column if not exists reminder_minutes integer[] not null default '{}',
  add column if not exists status text not null default 'planned'
    check (status in ('planned','done','cancelled')),
  add column if not exists budget numeric(10,2),
  add column if not exists memory_id uuid references public.memories(id) on delete set null;

create index if not exists shared_events_couple_status_idx
  on public.shared_events(couple_id, status, event_date);

drop policy if exists "shared events update by creator" on public.shared_events;
drop policy if exists "shared events update by couple" on public.shared_events;
create policy "shared events update by couple"
  on public.shared_events for update
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

drop policy if exists "shared events delete by creator" on public.shared_events;
drop policy if exists "shared events delete by couple" on public.shared_events;
create policy "shared events delete by couple"
  on public.shared_events for delete
  using (public.is_couple_member(couple_id));

create table if not exists public.shared_event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.shared_events(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  completed boolean not null default false,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shared_event_tasks_event_idx
  on public.shared_event_tasks(event_id, completed, created_at);

alter table public.shared_event_tasks enable row level security;

drop policy if exists "shared event tasks read by couple" on public.shared_event_tasks;
create policy "shared event tasks read by couple"
  on public.shared_event_tasks for select
  using (public.is_couple_member(couple_id));

drop policy if exists "shared event tasks insert by couple" on public.shared_event_tasks;
create policy "shared event tasks insert by couple"
  on public.shared_event_tasks for insert
  with check (public.is_couple_member(couple_id) and created_by = auth.uid());

drop policy if exists "shared event tasks update by couple" on public.shared_event_tasks;
create policy "shared event tasks update by couple"
  on public.shared_event_tasks for update
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

drop policy if exists "shared event tasks delete by creator" on public.shared_event_tasks;
create policy "shared event tasks delete by creator"
  on public.shared_event_tasks for delete
  using (public.is_couple_member(couple_id));

do $$ begin
  alter publication supabase_realtime add table public.shared_event_tasks;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
