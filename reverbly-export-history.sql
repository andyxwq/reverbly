-- Reverbly export history and private WAV downloads. Run once in Supabase SQL Editor.

alter table public.exports add column if not exists fade_in numeric(3,1) not null default 0;
alter table public.exports add column if not exists fade_out numeric(3,1) not null default 0;
alter table public.exports add column if not exists clip_start_seconds numeric(10,3) not null default 0;
alter table public.exports add column if not exists storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 104857600, array['audio/wav'])
on conflict (id) do nothing;

drop policy if exists "Users can read their export files" on storage.objects;
create policy "Users can read their export files"
  on storage.objects for select to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload their export files" on storage.objects;
create policy "Users can upload their export files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'exports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create index if not exists exports_user_created_at_idx
  on public.exports (user_id, created_at desc);
