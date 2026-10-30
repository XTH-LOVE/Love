drop policy if exists "answers read after both" on public.daily_answers;
drop policy if exists "answers create self" on public.daily_answers;
drop policy if exists "answers update self" on public.daily_answers;
drop policy if exists "daily answers read by couple" on public.daily_answers;
drop policy if exists "daily answers insert own" on public.daily_answers;
drop policy if exists "daily answers update own" on public.daily_answers;

create policy "daily answers read by couple"
  on public.daily_answers for select
  using (
    public.is_couple_member(couple_id)
    and exists (
      select 1
      from public.daily_questions q
      where q.id = daily_answers.question_id
        and q.couple_id = daily_answers.couple_id
        and public.is_couple_member(q.couple_id)
    )
  );

create policy "daily answers insert own"
  on public.daily_answers for insert
  with check (
    user_id = auth.uid()
    and public.is_couple_member(couple_id)
    and exists (
      select 1
      from public.daily_questions q
      where q.id = daily_answers.question_id
        and q.couple_id = daily_answers.couple_id
        and public.is_couple_member(q.couple_id)
    )
  );

create policy "daily answers update own"
  on public.daily_answers for update
  using (
    user_id = auth.uid()
    and public.is_couple_member(couple_id)
    and exists (
      select 1
      from public.daily_questions q
      where q.id = daily_answers.question_id
        and q.couple_id = daily_answers.couple_id
        and public.is_couple_member(q.couple_id)
    )
  )
  with check (
    user_id = auth.uid()
    and public.is_couple_member(couple_id)
    and exists (
      select 1
      from public.daily_questions q
      where q.id = daily_answers.question_id
        and q.couple_id = daily_answers.couple_id
        and public.is_couple_member(q.couple_id)
    )
  );

notify pgrst, 'reload schema';
