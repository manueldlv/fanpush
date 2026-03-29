insert into public.permissions (code, name, description)
values (
  'roles.manage',
  'Gestionar roles',
  'Permite asignar o revocar roles administrativos'
)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'roles.manage'
where r.code = 'super_admin'
on conflict do nothing;
