insert into storage.buckets (id, name, public)
values
  ('Imagenes', 'Imagenes', true),
  ('premium', 'premium', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_media_read_imagenes'
  ) then
    create policy public_media_read_imagenes
      on storage.objects
      for select
      using (bucket_id = 'Imagenes');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_upload_own_avatars'
  ) then
    create policy authenticated_upload_own_avatars
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'Imagenes'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_update_own_avatars'
  ) then
    create policy authenticated_update_own_avatars
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'Imagenes'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      with check (
        bucket_id = 'Imagenes'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated_delete_own_avatars'
  ) then
    create policy authenticated_delete_own_avatars
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'Imagenes'
        and (storage.foldername(name))[1] = 'avatars'
        and (storage.foldername(name))[2] = auth.uid()::text
      );
  end if;
end;
$$;
