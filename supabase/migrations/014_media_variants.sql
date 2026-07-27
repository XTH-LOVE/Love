-- Fast media delivery: retain path for old clients and add optional variants.
-- Existing rows remain valid and are progressively upgraded by new uploads.
alter table public.album_photos add column if not exists thumb_path text;
alter table public.album_photos add column if not exists medium_path text;
alter table public.album_photos add column if not exists original_path text;

comment on column public.album_photos.path is 'Legacy-compatible original media path';
comment on column public.album_photos.thumb_path is 'Small list/grid image path';
comment on column public.album_photos.medium_path is 'Medium timeline/lightbox image path';
comment on column public.album_photos.original_path is 'Original-quality download path';
