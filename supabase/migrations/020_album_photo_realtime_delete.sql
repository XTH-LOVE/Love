-- Both members own the shared album. Either member may remove a shared photo.
drop policy if exists "album photos delete by uploader" on public.album_photos;
drop policy if exists "album photos delete by couple" on public.album_photos;
create policy "album photos delete by couple"
  on public.album_photos for delete
  using (exists (
    select 1 from public.albums
    where public.albums.id = album_photos.album_id
      and public.is_couple_member(public.albums.couple_id)
  ));

-- Realtime needs the table in the publication so the other device removes it immediately.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'album_photos'
  ) then
    alter publication supabase_realtime add table public.album_photos;
  end if;
end $$;

-- Storage objects are shared by the couple as well.
drop policy if exists "album media delete uploader" on storage.objects;
drop policy if exists "album media delete couple" on storage.objects;
create policy "album media delete couple"
  on storage.objects for delete
  using (
    bucket_id = 'album-media'
    and public.is_couple_member((storage.foldername(name))[1]::uuid)
  );
