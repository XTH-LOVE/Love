create table if not exists public.future_letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  content text not null check (char_length(trim(content)) between 1 and 10000),
  unlock_at timestamptz not null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  constraint future_letters_sender_recipient_different check (sender_id <> recipient_id)
);

create index if not exists future_letters_couple_unlock_idx on public.future_letters(couple_id, unlock_at);
alter table public.future_letters enable row level security;
revoke all on table public.future_letters from anon, authenticated;

create or replace function public.create_future_letter(
  p_recipient_id uuid,
  p_title text,
  p_content text,
  p_unlock_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_couple uuid;
  letter_id uuid;
begin
  select couple_id into target_couple
  from public.couple_members
  where user_id = auth.uid();
  if target_couple is null then raise exception '请先绑定情侣空间'; end if;
  if not public.is_couple_member(target_couple, p_recipient_id) then raise exception '收件人不在当前情侣空间'; end if;
  if p_recipient_id = auth.uid() then raise exception '未来信箱需要写给另一半'; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then raise exception '信件标题需要 1-120 个字符'; end if;
  if p_content is null or char_length(trim(p_content)) not between 1 and 10000 then raise exception '信件正文需要 1-10000 个字符'; end if;
  if p_unlock_at is null or p_unlock_at <= now() then raise exception '解锁时间必须晚于现在'; end if;

  insert into public.future_letters(couple_id, sender_id, recipient_id, title, content, unlock_at)
  values(target_couple, auth.uid(), p_recipient_id, trim(p_title), trim(p_content), p_unlock_at)
  returning id into letter_id;
  return letter_id;
end;
$$;

create or replace function public.get_future_letters()
returns table(
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  title text,
  content text,
  unlock_at timestamptz,
  created_at timestamptz,
  opened_at timestamptz,
  is_unlocked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    letter.id,
    letter.sender_id,
    letter.recipient_id,
    letter.title,
    case when letter.unlock_at <= now() then letter.content else null end as content,
    letter.unlock_at,
    letter.created_at,
    letter.opened_at,
    (letter.unlock_at <= now()) as is_unlocked
  from public.future_letters letter
  where public.is_couple_member(letter.couple_id)
  order by letter.unlock_at asc, letter.created_at desc;
$$;

create or replace function public.mark_future_letter_opened(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.future_letters
  set opened_at = coalesce(opened_at, now())
  where id = p_letter_id and recipient_id = auth.uid() and unlock_at <= now();
end;
$$;

create or replace function public.delete_future_letter(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.future_letters
  where id = p_letter_id and sender_id = auth.uid();
end;
$$;

revoke all on function public.create_future_letter(uuid, text, text, timestamptz) from public;
revoke all on function public.get_future_letters() from public;
revoke all on function public.mark_future_letter_opened(uuid) from public;
revoke all on function public.delete_future_letter(uuid) from public;
grant execute on function public.create_future_letter(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.get_future_letters() to authenticated;
grant execute on function public.mark_future_letter_opened(uuid) to authenticated;
grant execute on function public.delete_future_letter(uuid) to authenticated;

notify pgrst, 'reload schema';
