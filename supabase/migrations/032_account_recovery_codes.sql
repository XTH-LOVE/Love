create table if not exists public.account_recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recovery_hash text not null check (recovery_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.account_recovery_codes enable row level security;
revoke all on table public.account_recovery_codes from anon, authenticated;

insert into public.account_recovery_codes(user_id, recovery_hash)
select id, raw_app_meta_data ->> 'recovery_hash'
from auth.users
where raw_app_meta_data ->> 'recovery_hash' ~ '^[0-9a-f]{64}$'
on conflict (user_id) do nothing;

create or replace function public.consume_account_recovery(p_username text, p_recovery_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_user_id uuid;
begin
  if p_username is null or p_username !~ '^[a-z0-9_]{4,20}$'
    or p_recovery_hash is null or p_recovery_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  delete from public.account_recovery_codes recovery
  using public.account_usernames account
  where recovery.user_id = account.user_id
    and account.username = p_username
    and recovery.recovery_hash = p_recovery_hash
  returning recovery.user_id into recovered_user_id;

  return recovered_user_id;
end;
$$;

revoke all on function public.consume_account_recovery(text, text) from public;
grant execute on function public.consume_account_recovery(text, text) to service_role;

notify pgrst, 'reload schema';
