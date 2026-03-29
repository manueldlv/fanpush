create or replace function public.handle_new_user_default_role()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_roles (user_id, role_id, granted_by)
  select new.id, r.id, new.id
  from public.roles r
  where r.code = 'user'
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_default_role on auth.users;

create trigger on_auth_user_created_default_role
after insert on auth.users
for each row execute procedure public.handle_new_user_default_role();
