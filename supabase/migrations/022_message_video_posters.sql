alter table public.messages add column if not exists media_poster_path text;

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
    or new.media_poster_path is distinct from old.media_poster_path
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

revoke all on function public.guard_message_update() from public;
notify pgrst, 'reload schema';
