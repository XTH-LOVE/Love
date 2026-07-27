-- Keep shared content when one member deletes their account; remove the
-- couple and its private data only when no partner remains.
alter table public.profiles add column if not exists last_login_user_agent text;
alter table public.profiles add column if not exists last_login_at timestamptz;

create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_couple uuid;
  partner_id uuid;
  member_count integer;
begin
  if current_user_id is null then raise exception '未登录'; end if;
  select couple_id into target_couple from public.couple_members where user_id = current_user_id;
  if target_couple is null then
    delete from public.profiles where id = current_user_id;
    return;
  end if;

  select count(*) into member_count from public.couple_members where couple_id = target_couple;
  select user_id into partner_id from public.couple_members where couple_id = target_couple and user_id <> current_user_id limit 1;
  if member_count <= 1 then
    delete from public.couples where id = target_couple;
  else
    update public.memories set author_id = partner_id where couple_id = target_couple and author_id = current_user_id;
    update public.albums set created_by = partner_id where couple_id = target_couple and created_by = current_user_id;
    update public.album_photos set uploaded_by = partner_id where album_id in (select id from public.albums where couple_id = target_couple) and uploaded_by = current_user_id;
    update public.messages set sender_id = partner_id where couple_id = target_couple and sender_id = current_user_id;
    update public.couple_letters set sender_id = partner_id where couple_id = target_couple and sender_id = current_user_id;
    update public.couple_letters set recipient_id = partner_id where couple_id = target_couple and recipient_id = current_user_id;
    update public.anniversaries set created_by = partner_id where couple_id = target_couple and created_by = current_user_id;
    update public.together_items set created_by = partner_id where couple_id = target_couple and created_by = current_user_id;
    update public.together_items set completed_by = partner_id where couple_id = target_couple and completed_by = current_user_id;
    update public.ai_saved_works set user_id = partner_id where couple_id = target_couple and user_id = current_user_id;
    update public.invitations set created_by = partner_id where couple_id = target_couple and created_by = current_user_id;
    update public.invitations set accepted_by = partner_id where couple_id = target_couple and accepted_by = current_user_id;
    update public.couples set created_by = partner_id where id = target_couple and created_by = current_user_id;
    delete from public.couple_members where couple_id = target_couple and user_id = current_user_id;
  end if;
  delete from public.profiles where id = current_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
