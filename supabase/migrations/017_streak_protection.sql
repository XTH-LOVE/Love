-- Make the existing protection_count field functional.
-- Missing one day can consume one protection; every 7-day milestone earns one,
-- capped at three stored protections.
create or replace function public.record_couple_activity_core(p_activity_date date default null)
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
    days_since_last := case
      when streak.last_completed_date is null then null
      else p_activity_date - streak.last_completed_date
    end;

    if days_since_last = 1 then
      next_current_days := streak.current_days + 1;
    elsif days_since_last = 2 and streak.protection_count > 0 then
      next_current_days := streak.current_days + 1;
      protection_used := true;
    else
      next_current_days := 1;
    end if;

    protection_earned := mod(next_current_days, 7) = 0;

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
    'newly_completed', newly_completed,
    'protection_used', protection_used,
    'protection_earned', protection_earned
  );
end;
$$;

-- Keep the existing public RPC name used by all current clients.
create or replace function public.record_couple_activity(p_activity_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.record_couple_activity_core(p_activity_date);
end;
$$;

revoke all on function public.record_couple_activity_core(date) from public;
grant execute on function public.record_couple_activity_core(date) to authenticated;
revoke all on function public.record_couple_activity(date) from public;
grant execute on function public.record_couple_activity(date) to authenticated;
