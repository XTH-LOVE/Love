drop policy if exists "zego call receive by couple" on realtime.messages;
create policy "zego call receive by couple"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() ~ '^zego-call:[0-9a-f-]{36}$'
    and public.is_couple_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

drop policy if exists "zego call publish by couple" on realtime.messages;
create policy "zego call publish by couple"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() ~ '^zego-call:[0-9a-f-]{36}$'
    and public.is_couple_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

drop policy if exists "zego live receive by couple" on realtime.messages;
create policy "zego live receive by couple"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() ~ '^zego-live:[0-9a-f-]{36}$'
    and public.is_couple_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

drop policy if exists "zego live publish by couple" on realtime.messages;
create policy "zego live publish by couple"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() ~ '^zego-live:[0-9a-f-]{36}$'
    and public.is_couple_member(split_part(realtime.topic(), ':', 2)::uuid)
  );
