-- Keep client updates limited to the fields each workflow is allowed to change.
-- RLS decides who may target a row; these triggers protect row ownership fields.

alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_type text;
alter table public.messages drop constraint if exists messages_check;
alter table public.messages drop constraint if exists messages_content_or_media_check;
alter table public.messages add constraint messages_content_or_media_check
  check (content is not null or image_path is not null or media_path is not null);
alter table public.messages drop constraint if exists messages_media_type_check;
alter table public.messages add constraint messages_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio'));

create or replace function public.is_same_couple_user(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members mine
    join public.couple_members target on target.couple_id = mine.couple_id
    where mine.user_id = auth.uid() and target.user_id = p_target_user_id
  );
$$;

drop policy if exists "avatars read by authenticated" on storage.objects;
drop policy if exists "avatars read by couple" on storage.objects;
create policy "avatars read by couple" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and public.is_same_couple_user((storage.foldername(name))[1]::uuid)
);

create or replace function public.guard_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.couple_id is distinct from old.couple_id
    or new.sender_id is distinct from old.sender_id
    or new.content is distinct from old.content
    or new.image_path is distinct from old.image_path
    or new.media_path is distinct from old.media_path
    or new.media_type is distinct from old.media_type
    or new.created_at is distinct from old.created_at then
    raise exception '消息归属和内容不可修改';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update
before update on public.messages
for each row execute function public.guard_message_update();

create or replace function public.guard_together_item_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.couple_id is distinct from old.couple_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception '清单归属不可修改';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_together_item_update on public.together_items;
create trigger guard_together_item_update
before update on public.together_items
for each row execute function public.guard_together_item_update();

create or replace function public.guard_anniversary_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.couple_id is distinct from old.couple_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception '纪念日归属不可修改';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_anniversary_update on public.anniversaries;
create trigger guard_anniversary_update
before update on public.anniversaries
for each row execute function public.guard_anniversary_update();

create or replace function public.guard_ai_work_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.couple_id is distinct from old.couple_id
    or new.user_id is distinct from old.user_id
    or new.kind is distinct from old.kind
    or new.work_date is distinct from old.work_date
    or new.memory_id is distinct from old.memory_id
    or new.created_at is distinct from old.created_at then
    raise exception 'AI 作品归属不可修改';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_ai_work_update on public.ai_saved_works;
create trigger guard_ai_work_update
before update on public.ai_saved_works
for each row execute function public.guard_ai_work_update();

revoke all on function public.guard_message_update() from public;
revoke all on function public.guard_together_item_update() from public;
revoke all on function public.guard_anniversary_update() from public;
revoke all on function public.guard_ai_work_update() from public;
revoke all on function public.is_same_couple_user(uuid) from public;

create or replace function public.save_ai_diary(
  p_work_date date,
  p_title text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple uuid;
  existing_work public.ai_saved_works%rowtype;
  target_memory uuid;
begin
  select couple_id into target_couple
  from public.couple_members
  where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  if p_content is null or char_length(trim(p_content)) not between 1 and 1000 then
    raise exception '日记内容需要 1-1000 个字符';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then
    raise exception '日记标题格式不正确';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_couple::text || ':' || p_work_date::text, 0));
  select * into existing_work
  from public.ai_saved_works
  where couple_id = target_couple and kind = 'diary' and work_date = p_work_date
  for update;

  if existing_work.id is not null then
    target_memory := existing_work.memory_id;
    if target_memory is not null then
      update public.memories
      set content = trim(p_content), memory_date = p_work_date, updated_at = now()
      where id = target_memory and couple_id = target_couple;
    else
      insert into public.memories(couple_id, author_id, content, memory_date, photos)
      values(target_couple, auth.uid(), trim(p_content), p_work_date, '[]'::jsonb)
      returning id into target_memory;
    end if;
    update public.ai_saved_works
    set content = trim(p_content), title = trim(p_title), memory_id = target_memory, updated_at = now()
    where id = existing_work.id;
    return existing_work.id;
  end if;

  insert into public.memories(couple_id, author_id, content, memory_date, photos)
  values(target_couple, auth.uid(), trim(p_content), p_work_date, '[]'::jsonb)
  returning id into target_memory;
  insert into public.ai_saved_works(couple_id, user_id, kind, work_date, title, content, memory_id)
  values(target_couple, auth.uid(), 'diary', p_work_date, trim(p_title), trim(p_content), target_memory)
  returning id into existing_work.id;
  return existing_work.id;
end;
$$;

revoke all on function public.save_ai_diary(date, text, text) from public;
grant execute on function public.save_ai_diary(date, text, text) to authenticated;

create table if not exists public.account_usernames(
  username text primary key check (username ~ '^[a-z0-9_]{4,20}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.account_usernames enable row level security;
revoke all on table public.account_usernames from anon, authenticated;

create or replace function public.sync_account_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_username text;
begin
  if coalesce(new.raw_user_meta_data ->> 'login_type', '') <> 'username' then
    return new;
  end if;
  next_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-z0-9_]', '', 'g'));
  if next_username !~ '^[a-z0-9_]{4,20}$' then
    raise exception '账号名格式不正确';
  end if;
  insert into public.account_usernames(username, user_id)
  values(next_username, new.id);
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_username_created') then
    create trigger on_username_created
    after insert on auth.users
    for each row execute function public.sync_account_username();
  end if;
end $$;

insert into public.account_usernames(username, user_id)
select lower(regexp_replace(raw_user_meta_data ->> 'username', '[^a-z0-9_]', '', 'g')), id
from auth.users
where coalesce(raw_user_meta_data ->> 'login_type', '') = 'username'
  and (raw_user_meta_data ->> 'username') ~ '^[a-zA-Z0-9_]{4,20}$'
on conflict (username) do nothing;

revoke all on function public.sync_account_username() from public;

notify pgrst, 'reload schema';
