-- =============================================================
-- 026: 心情签到 + 每日问答 + 共享日历
-- =============================================================

-- ── 0. 旧表兼容（心动AI 时代已建过 daily_questions/daily_answers，列名不同）──
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'daily_questions') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_questions' and column_name = 'question')
       and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_questions' and column_name = 'question_text') then
      alter table public.daily_questions rename column question to question_text;
    end if;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'daily_answers') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'answer')
       and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'answer_text') then
      alter table public.daily_answers rename column answer to answer_text;
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_answers' and column_name = 'couple_id') then
      alter table public.daily_answers add column couple_id uuid references public.couples(id) on delete cascade;
      update public.daily_answers a
        set couple_id = q.couple_id
        from public.daily_questions q
        where a.question_id = q.id and a.couple_id is null;
      delete from public.daily_answers where couple_id is null;
      alter table public.daily_answers alter column couple_id set not null;
    end if;
  end if;
end $$;

-- ── 1. 心情签到 ──────────────────────────────────────────────
create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mood text not null check (mood in ('happy','love','calm','sad','angry','anxious','excited','tired')),
  note text,
  mood_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (couple_id, user_id, mood_date)
);

create index if not exists mood_checkins_couple_date_idx
  on public.mood_checkins(couple_id, mood_date desc);

alter table public.mood_checkins enable row level security;

drop policy if exists "mood checkins read by couple" on public.mood_checkins;
create policy "mood checkins read by couple"
  on public.mood_checkins for select
  using (public.is_couple_member(couple_id));

drop policy if exists "mood checkins insert own" on public.mood_checkins;
create policy "mood checkins insert own"
  on public.mood_checkins for insert
  with check (public.is_couple_member(couple_id) and user_id = auth.uid());

drop policy if exists "mood checkins delete own" on public.mood_checkins;
create policy "mood checkins delete own"
  on public.mood_checkins for delete
  using (user_id = auth.uid());

-- ── 2. 每日问答 ──────────────────────────────────────────────
create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  question_date date not null default current_date,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (couple_id, question_date)
);

create index if not exists daily_questions_couple_date_idx
  on public.daily_questions(couple_id, question_date desc);

create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text not null,
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists daily_answers_question_idx
  on public.daily_answers(question_id);

alter table public.daily_questions enable row level security;
alter table public.daily_answers enable row level security;

drop policy if exists "daily questions read by couple" on public.daily_questions;
create policy "daily questions read by couple"
  on public.daily_questions for select
  using (public.is_couple_member(couple_id));

drop policy if exists "daily questions insert by couple" on public.daily_questions;
create policy "daily questions insert by couple"
  on public.daily_questions for insert
  with check (public.is_couple_member(couple_id));

drop policy if exists "daily answers read by couple" on public.daily_answers;
create policy "daily answers read by couple"
  on public.daily_answers for select
  using (public.is_couple_member(couple_id));

drop policy if exists "daily answers insert own" on public.daily_answers;
create policy "daily answers insert own"
  on public.daily_answers for insert
  with check (public.is_couple_member(couple_id) and user_id = auth.uid());

drop policy if exists "daily answers update own" on public.daily_answers;
create policy "daily answers update own"
  on public.daily_answers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 3. 共享日历 ──────────────────────────────────────────────
create table if not exists public.shared_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  event_type text not null default 'other' check (event_type in ('date','schedule','class','reminder','birthday','other')),
  location text,
  created_at timestamptz not null default now()
);

create index if not exists shared_events_couple_date_idx
  on public.shared_events(couple_id, event_date);

alter table public.shared_events enable row level security;

drop policy if exists "shared events read by couple" on public.shared_events;
create policy "shared events read by couple"
  on public.shared_events for select
  using (public.is_couple_member(couple_id));

drop policy if exists "shared events insert by couple" on public.shared_events;
create policy "shared events insert by couple"
  on public.shared_events for insert
  with check (public.is_couple_member(couple_id) and created_by = auth.uid());

drop policy if exists "shared events update by creator" on public.shared_events;
create policy "shared events update by creator"
  on public.shared_events for update
  using (public.is_couple_member(couple_id) and created_by = auth.uid())
  with check (public.is_couple_member(couple_id) and created_by = auth.uid());

drop policy if exists "shared events delete by creator" on public.shared_events;
create policy "shared events delete by creator"
  on public.shared_events for delete
  using (public.is_couple_member(couple_id) and created_by = auth.uid());

-- Realtime（幂等：已加入则忽略 42710 重复错误）
do $$ begin
  alter publication supabase_realtime add table public.mood_checkins;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.daily_answers;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.shared_events;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
