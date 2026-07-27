-- Keep the shared streak clock in the couple's primary timezone.
-- The web client consumes the date returned by these functions instead of
-- deriving a UTC date locally.
create or replace function public.get_couple_streak_status()
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
  today_date date := (now() at time zone 'Asia/Shanghai')::date;
  effective_current_days integer;
begin
  select couple_id into target_couple
  from public.couple_members
  where user_id = auth.uid();

  if target_couple is null then
    raise exception '请先绑定情侣空间';
  end if;

  perform public.ensure_couple_pet();

  select * into streak
  from public.couple_streaks
  where couple_id = target_couple;

  select * into pet
  from public.couple_pets
  where couple_id = target_couple;

  select count(*) into completed_count
  from public.streak_day_actions
  where couple_id = target_couple
    and activity_date = today_date;

  effective_current_days := case
    when streak.last_completed_date is null then 0
    when streak.last_completed_date >= today_date - 1 then streak.current_days
    else 0
  end;

  return jsonb_build_object(
    'today', today_date,
    'today_action_count', completed_count,
    'today_completed', completed_count >= 2,
    'streak', to_jsonb(streak) || jsonb_build_object('current_days', effective_current_days),
    'pet', to_jsonb(pet)
  );
end;
$$;

-- Recreate the write function so an omitted date uses the same Shanghai date
-- as the status function. Existing callers can continue omitting the arg.
create or replace function public.record_couple_activity(p_activity_date date default null)
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
  today_date date := (now() at time zone 'Asia/Shanghai')::date;
  effective_current_days integer;
begin
  p_activity_date := coalesce(p_activity_date, today_date);
  if p_activity_date <> today_date then
    raise exception '只能记录今天的情侣互动';
  end if;

  select couple_id into target_couple
  from public.couple_members
  where user_id = auth.uid();

  if target_couple is null then
    raise exception '请先绑定情侣空间';
  end if;

  perform public.ensure_couple_pet();

  insert into public.streak_day_actions (couple_id, activity_date, user_id)
  values (target_couple, p_activity_date, auth.uid())
  on conflict do nothing;

  select count(*) into completed_count
  from public.streak_day_actions
  where couple_id = target_couple
    and activity_date = p_activity_date;

  select * into streak
  from public.couple_streaks
  where couple_id = target_couple
  for update;

  if completed_count >= 2 and streak.last_completed_date is distinct from p_activity_date then
    newly_completed := true;
    update public.couple_streaks
    set current_days = case
          when streak.last_completed_date = p_activity_date - 1 then streak.current_days + 1
          else 1
        end,
        longest_days = greatest(
          streak.longest_days,
          case
            when streak.last_completed_date = p_activity_date - 1 then streak.current_days + 1
            else 1
          end
        ),
        last_completed_date = p_activity_date,
        level = least(100, greatest(1, floor((case
          when streak.last_completed_date = p_activity_date - 1 then streak.current_days + 1
          else 1
        end - 1) / 7) + 1)::integer),
        updated_at = now()
    where couple_id = target_couple
    returning * into streak;

    update public.couple_pets
    set experience = experience + 5,
        level = least(100, floor((experience + 5) / 50) + 1),
        mood = least(100, mood + 8),
        hunger = greatest(0, hunger - 3),
        updated_at = now()
    where couple_id = target_couple
    returning * into pet;
  else
    select * into pet
    from public.couple_pets
    where couple_id = target_couple;
  end if;

  effective_current_days := case
    when streak.last_completed_date is null then 0
    when streak.last_completed_date >= today_date - 1 then streak.current_days
    else 0
  end;

  return jsonb_build_object(
    'today', today_date,
    'today_action_count', completed_count,
    'streak', to_jsonb(streak) || jsonb_build_object('current_days', effective_current_days),
    'pet', to_jsonb(pet),
    'today_completed', completed_count >= 2,
    'newly_completed', newly_completed
  );
end;
$$;

revoke all on function public.get_couple_streak_status() from public;
grant execute on function public.get_couple_streak_status() to authenticated;
revoke all on function public.record_couple_activity(date) from public;
grant execute on function public.record_couple_activity(date) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'streak_day_actions'
  ) then
    alter publication supabase_realtime add table public.streak_day_actions;
  end if;
end $$;
