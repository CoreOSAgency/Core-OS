-- Profile photo storage: public read (avatars are shown in the UI), writes
-- scoped to the owner's own folder (path convention: {user_id}/avatar.*).
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "profile_photos_read_all"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "profile_photos_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_photos_update_own"
  on storage.objects for update
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_photos_delete_own"
  on storage.objects for delete
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
