insert into public.users (id, username, created_at, updated_at)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  now(),
  now()
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'albums_user_id_public_users_fk'
  ) then
    alter table public.albums
      add constraint albums_user_id_public_users_fk
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_user_id_public_users_fk'
  ) then
    alter table public.posts
      add constraint posts_user_id_public_users_fk
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end;
$$;
