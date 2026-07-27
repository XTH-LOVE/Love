-- Activity context, streak history, milestones, and shared pet-house rewards.
alter table public.streak_day_actions
  add column if not exists activity_type text not null default 'manual',
  add column if not exists mood integer,
  add column if not exists note text;

alter table public.streak_day_actions
  drop constraint if exists streak_day_actions_mood_check;
alter table public.streak_day_actions
  add constraint streak_day_actions_mood_check check (mood is null or mood between 1 and 5);
alter table public.streak_day_actions
  drop constraint if exists streak_day_actions_note_check;
alter table public.streak_day_actions
  add constraint streak_day_actions_note_check check (note is null or char_length(note) <= 240);

create table if not exists public.streak_activity_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  activity_date date not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null default 'manual',
  mood integer,
  note text,
  created_at timestamptz not null default now(),
  constraint streak_activity_events_mood_check check (mood is null or mood between 1 and 5),
  constraint streak_activity_events_note_check check (note is null or char_length(note) <= 240)
);

create index if not exists streak_activity_events_lookup_idx
  on public.streak_activity_events (couple_id, activity_date, created_at desc);

create table if not exists public.couple_streak_milestones (
  couple_id uuid not null references public.couples(id) on delete cascade,
  milestone_days integer not null check (milestone_days in (3, 7, 14, 30, 100)),
  reward_key text not null,
  achieved_at timestamptz not null default now(),
  primary key (couple_id, milestone_days)
);

create table if not exists public.couple_pet_rewards (
  couple_id uuid not null references public.couples(id) on delete cascade,
  reward_key text not null,
  reward_type text not null check (reward_type in ('accessory', 'furniture')),
  unlocked_at timestamptz not null default now(),
  primary key (couple_id, reward_key)
);

alter table public.streak_activity_events enable row level security;
alter table public.couple_streak_milestones enable row level security;
alter table public.couple_pet_rewards enable row level security;

drop policy if exists "streak events read by couple" on public.streak_activity_events;
create policy "streak events read by couple" on public.streak_activity_events
  for select using (public.is_couple_member(couple_id));
drop policy if exists "streak milestones read by couple" on public.couple_streak_milestones;
create policy "streak milestones read by couple" on public.couple_streak_milestones
  for select using (public.is_couple_member(couple_id));
drop policy if exists "pet rewards read by couple" on public.couple_pet_rewards;
create policy "pet rewards read by couple" on public.couple_pet_rewards
  for select using (public.is_couple_member(couple_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'streak_activity_events'
  ) then
    alter publication supabase_realtime add table public.streak_activity_events;
  end if;
end $$;

create or replace function public.record_couple_activity_context(
  p_activity_date date,
  p_activity_type text,
  p_mood integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple uuid;
  streak public.couple_streaks;
  pet public.couple_pets;
  completed_count integer;
  newly_completed boolean := false;
  protection_used boolean := false;
  protection_earned boolean := false;
  today_date date := (now() at time zone 'Asia/Shanghai')::date;
  days_since_last integer;
  next_current_days integer;
  effective_current_days integer;
  milestone_days integer;
  reward_key text;
  reward_type text;
  activity_type text := coalesce(nullif(trim(p_activity_type), ''), 'manual');
  note_value text := nullif(left(trim(coalesce(p_note, '')), 240), '');
begin
  p_activity_date := coalesce(p_activity_date, today_date);
  if p_activity_date <> today_date then
    raise exception '只能记录今天的情侣互动';
  end if;
  if activity_type not in ('manual', 'message', 'photo', 'video', 'memory', 'checklist', 'letter', 'ai', 'pet', 'other') then
    activity_type := 'other';
  end if;
  if p_mood is not null and (p_mood < 1 or p_mood > 5) then
    raise exception '今日心情必须是 1 到 5';
  end if;

  select couple_id into target_couple
  from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  perform public.ensure_couple_pet();

  insert into public.streak_activity_events (couple_id, activity_date, actor_id, activity_type, mood, note)
  values (target_couple, p_activity_date, auth.uid(), activity_type, p_mood, note_value);

  insert into public.streak_day_actions (couple_id, activity_date, user_id, activity_type, mood, note)
  values (target_couple, p_activity_date, auth.uid(), activity_type, p_mood, note_value)
  on conflict (couple_id, activity_date, user_id) do update
    set activity_type = excluded.activity_type,
        mood = coalesce(excluded.mood, public.streak_day_actions.mood),
        note = coalesce(excluded.note, public.streak_day_actions.note),
        created_at = now();

  select count(*) into completed_count
  from public.streak_day_actions
  where couple_id = target_couple and activity_date = p_activity_date;

  select * into streak from public.couple_streaks
  where couple_id = target_couple for update;

  if completed_count >= 2 and streak.last_completed_date is distinct from p_activity_date then
    newly_completed := true;
    days_since_last := case when streak.last_completed_date is null then null else p_activity_date - streak.last_completed_date end;
    if days_since_last = 1 then
      next_current_days := streak.current_days + 1;
    elsif days_since_last = 2 and streak.protection_count > 0 then
      next_current_days := streak.current_days + 1;
      protection_used := true;
    else
      next_current_days := 1;
    end if;

    protection_earned := mod(next_current_days, 7) = 0;
    if next_current_days in (3, 7, 14, 30, 100) then
      milestone_days := next_current_days;
      reward_key := case next_current_days
        when 3 then 'pet-accessory-flower'
        when 7 then 'house-furniture-love-lamp'
        when 14 then 'pet-accessory-crown'
        when 30 then 'house-furniture-moon-sofa'
        when 100 then 'pet-accessory-bow'
      end;
      reward_type := case when next_current_days in (7, 30) then 'furniture' else 'accessory' end;
      insert into public.couple_streak_milestones (couple_id, milestone_days, reward_key)
      values (target_couple, milestone_days, reward_key)
      on conflict do nothing;
      if not found then
        milestone_days := null;
        reward_key := null;
      else
        insert into public.couple_pet_rewards (couple_id, reward_key, reward_type)
        values (target_couple, reward_key, reward_type)
        on conflict do nothing;
      end if;
    end if;

    update public.couple_streaks
    set current_days = next_current_days,
        longest_days = greatest(streak.longest_days, next_current_days),
        last_completed_date = p_activity_date,
        protection_count = least(3, greatest(0, streak.protection_count
          - case when protection_used then 1 else 0 end
          + case when protection_earned then 1 else 0 end)),
        level = least(100, greatest(1, floor((next_current_days - 1) / 7) + 1)::integer),
        updated_at = now()
    where couple_id = target_couple
    returning * into streak;

    update public.couple_pets
    set experience = experience + 5 + case when milestone_days is not null then 10 else 0 end,
        level = least(100, floor((experience + 5 + case when milestone_days is not null then 10 else 0 end) / 50) + 1),
        mood = least(100, mood + 8),
        hunger = greatest(0, hunger - 3),
        updated_at = now()
    where couple_id = target_couple
    returning * into pet;
  else
    select * into pet from public.couple_pets where couple_id = target_couple;
  end if;

  effective_current_days := case
    when streak.last_completed_date is null then 0
    when streak.last_completed_date >= today_date - 1 then streak.current_days
    else 0
  end;

  return public.get_couple_streak_status_payload(target_couple, today_date, completed_count, streak, pet,
    newly_completed, protection_used, protection_earned, milestone_days, reward_key);
end;
$$;

-- Shared payload helper keeps the status and write RPCs consistent.
create or replace function public.get_couple_streak_status_payload(
  target_couple uuid,
  today_date date,
  completed_count integer,
  streak public.couple_streaks,
  pet public.couple_pets,
  newly_completed boolean default false,
  protection_used boolean default false,
  protection_earned boolean default false,
  milestone_days integer default null,
  reward_key text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'today', today_date,
    'today_action_count', completed_count,
    'today_completed', completed_count >= 2,
    'today_actor_ids', coalesce((select jsonb_agg(user_id order by user_id) from public.streak_day_actions where couple_id = target_couple and activity_date = today_date), '[]'::jsonb),
    'today_actions', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'activity_type', activity_type, 'mood', mood, 'note', note, 'created_at', created_at) order by created_at) from public.streak_day_actions where couple_id = target_couple and activity_date = today_date), '[]'::jsonb),
    'streak', to_jsonb(streak) || jsonb_build_object('current_days', case
      when streak.last_completed_date is null then 0
      when streak.last_completed_date >= today_date - 1 then streak.current_days
      else 0
    end),
    'pet', to_jsonb(pet),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('reward_key', reward_key, 'reward_type', reward_type, 'unlocked_at', unlocked_at) order by unlocked_at) from public.couple_pet_rewards where couple_id = target_couple), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('days', milestone_days, 'reward_key', reward_key, 'achieved_at', achieved_at) order by milestone_days) from public.couple_streak_milestones where couple_id = target_couple), '[]'::jsonb),
    'newly_completed', newly_completed,
    'protection_used', protection_used,
    'protection_earned', protection_earned,
    'milestone_days', milestone_days,
    'reward_key', reward_key
  );
$$;

create or replace function public.record_couple_activity(p_activity_date date default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  return public.record_couple_activity_context(p_activity_date, 'manual', null, null);
end;
$$;

create or replace function public.get_couple_streak_status()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  target_couple uuid;
  streak public.couple_streaks;
  pet public.couple_pets;
  completed_count integer;
  today_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select couple_id into target_couple from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  perform public.ensure_couple_pet();
  select * into streak from public.couple_streaks where couple_id = target_couple;
  select * into pet from public.couple_pets where couple_id = target_couple;
  select count(*) into completed_count from public.streak_day_actions where couple_id = target_couple and activity_date = today_date;
  return public.get_couple_streak_status_payload(target_couple, today_date, completed_count, streak, pet);
end;
$$;

create or replace function public.get_couple_streak_history(p_month date default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  target_couple uuid;
  today_date date := (now() at time zone 'Asia/Shanghai')::date;
  month_start date := date_trunc('month', coalesce(p_month, today_date))::date;
  month_end date := (month_start + interval '1 month')::date;
begin
  select couple_id into target_couple from public.couple_members where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  return jsonb_build_object(
    'month', month_start,
    'days', coalesce((select jsonb_agg(day_row order by (day_row->>'date')) from (select jsonb_build_object('date', activity_date, 'count', count(*), 'actor_ids', jsonb_agg(user_id order by user_id), 'sources', jsonb_agg(distinct activity_type)) as day_row from public.streak_day_actions where couple_id = target_couple and activity_date >= month_start and activity_date < month_end group by activity_date) grouped_days), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('date', activity_date, 'actor_id', actor_id, 'activity_type', activity_type, 'mood', mood, 'note', note, 'created_at', created_at) order by created_at desc) from public.streak_activity_events where couple_id = target_couple and activity_date >= month_start and activity_date < month_end), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('days', milestone_days, 'reward_key', reward_key, 'achieved_at', achieved_at) order by milestone_days) from public.couple_streak_milestones where couple_id = target_couple), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('reward_key', reward_key, 'reward_type', reward_type, 'unlocked_at', unlocked_at) order by unlocked_at) from public.couple_pet_rewards where couple_id = target_couple), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.record_couple_activity_context(date, text, integer, text) from public;
grant execute on function public.record_couple_activity_context(date, text, integer, text) to authenticated;
revoke all on function public.get_couple_streak_status_payload(uuid, date, integer, public.couple_streaks, public.couple_pets, boolean, boolean, boolean, integer, text) from public;
revoke all on function public.get_couple_streak_status() from public;
grant execute on function public.get_couple_streak_status() to authenticated;
revoke all on function public.get_couple_streak_history(date) from public;
grant execute on function public.get_couple_streak_history(date) to authenticated;
