-- Phase B Storage Migration: setup
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Safe to re-run: all statements are idempotent.

-- 1. Create the 'avatars' bucket (public so we can serve via CDN URL).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2. Storage RLS policies.
-- Path convention: avatars/{user_id}/avatar.{ext}
-- Authenticated users can write only to their own folder; everyone can read.

drop policy if exists "avatar_read_public" on storage.objects;
create policy "avatar_read_public" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatar_upload_own" on storage.objects;
create policy "avatar_upload_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Schema additions on existing tables.
-- We keep logo_data / image_data during migration for safe rollback;
-- drop them in Phase B7 once stable.

alter table freelancer_logos
  add column if not exists logo_path text;

alter table agency_image
  add column if not exists image_path text;

-- Allow new uploads to skip the legacy base64 columns.
alter table freelancer_logos alter column logo_data drop not null;
alter table agency_image alter column image_data drop not null;
