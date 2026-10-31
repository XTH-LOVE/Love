-- 036: one realtime activity stream for the whole couple space.
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('message','memory','photo','album','calendar','list','anniversary','letter','ai','mood','question','voice','music','system')),
  target text not null check (target in ('首页','悄悄话','时光','相册','清单','纪念日','日历','心动AI','一起听')),
  entity_id text not null default '',
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_events_couple_created_idx
  on public.activity_events(couple_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "activity events read by couple" on public.activity_events;
create policy "activity events read by couple"
  on public.activity_events for select
  using (public.is_couple_member(couple_id));

drop policy if exists "activity events insert own" on public.activity_events;
create policy "activity events insert own"
  on public.activity_events for insert
  with check (actor_id = auth.uid() and public.is_couple_member(couple_id));

-- Trigger-generated rows run as the database owner and are not exposed as a
-- client write API. This keeps activity records consistent with the source row.
create or replace function public.record_couple_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  couple_id_value uuid;
  actor_id_value uuid;
  entity_id_value text;
  kind_value text;
  target_value text;
  title_value text;
  body_value text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  couple_id_value := nullif(row_data->>'couple_id', '')::uuid;

  if tg_table_name = 'album_photos' and couple_id_value is null then
    select a.couple_id into couple_id_value
      from public.albums a
      where a.id = nullif(row_data->>'album_id', '')::uuid;
  end if;

  actor_id_value := coalesce(
    nullif(row_data->>'sender_id', '')::uuid,
    nullif(row_data->>'author_id', '')::uuid,
    nullif(row_data->>'created_by', '')::uuid,
    nullif(row_data->>'uploaded_by', '')::uuid,
    nullif(row_data->>'user_id', '')::uuid,
    nullif(row_data->>'actor_id', '')::uuid,
    auth.uid()
  );
  if couple_id_value is null or actor_id_value is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  entity_id_value := coalesce(row_data->>'id', '');
  kind_value := case tg_table_name
    when 'messages' then 'message'
    when 'memories' then 'memory'
    when 'album_photos' then 'photo'
    when 'albums' then 'album'
    when 'shared_events' then 'calendar'
    when 'shared_event_tasks' then 'calendar'
    when 'together_items' then 'list'
    when 'anniversaries' then 'anniversary'
    when 'couple_letters' then 'letter'
    when 'ai_saved_works' then 'ai'
    when 'mood_checkins' then 'mood'
    when 'daily_answers' then 'question'
    when 'voice_capsules' then 'voice'
    when 'music_room_messages' then 'music'
    else 'system'
  end;
  target_value := case kind_value
    when 'message' then '悄悄话'
    when 'memory' then '时光'
    when 'photo' then '相册'
    when 'album' then '相册'
    when 'calendar' then '日历'
    when 'list' then '清单'
    when 'anniversary' then '纪念日'
    when 'letter' then '悄悄话'
    when 'ai' then '心动AI'
    when 'mood' then '首页'
    when 'question' then '首页'
    when 'voice' then '悄悄话'
    when 'music' then '一起听'
    else '首页'
  end;

  title_value := case
    when tg_op = 'DELETE' then '删除了一项内容'
    when tg_op = 'UPDATE' then '更新了一项内容'
    when kind_value = 'message' then '发来了一条悄悄话'
    when kind_value = 'memory' then '记录了一段时光'
    when kind_value = 'photo' then '添加了照片或视频'
    when kind_value = 'album' then '创建了一个相册'
    when kind_value = 'calendar' then '更新了共享日历'
    when kind_value = 'list' then '更新了一项共同清单'
    when kind_value = 'anniversary' then '添加了一个纪念日'
    when kind_value = 'letter' then '写了一封情书'
    when kind_value = 'ai' then '保存了一份 AI 记录'
    when kind_value = 'mood' then '完成了今日心情'
    when kind_value = 'question' then '回答了每日问题'
    when kind_value = 'voice' then '留下了一段声音'
    when kind_value = 'music' then '在一起听里发了消息'
    else '空间有新动态'
  end;
  body_value := coalesce(
    nullif(row_data->>'content', ''),
    nullif(row_data->>'title', ''),
    nullif(row_data->>'name', ''),
    nullif(row_data->>'note', ''),
    nullif(row_data->>'answer_text', ''),
    '点击查看详情'
  );

  insert into public.activity_events(couple_id, actor_id, kind, target, entity_id, title, body)
  values (couple_id_value, actor_id_value, kind_value, target_value, entity_id_value, title_value, left(body_value, 240));
  return coalesce(new, old);
exception when others then
  -- Activity must never make the user's original write fail.
  raise warning 'activity event skipped for %.%: %', tg_table_schema, tg_table_name, sqlerrm;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'messages','memories','album_photos','albums','shared_events',
    'shared_event_tasks','together_items','anniversaries','couple_letters',
    'ai_saved_works','mood_checkins','daily_answers','voice_capsules',
    'music_room_messages'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists couple_activity_%I on public.%I', table_name, table_name);
      execute format(
        'create trigger couple_activity_%I after insert or update or delete on public.%I for each row execute function public.record_couple_activity()',
        table_name, table_name
      );
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_events'
  ) then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end $$;

notify pgrst, 'reload schema';
