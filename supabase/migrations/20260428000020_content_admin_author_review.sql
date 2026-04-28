insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'authors.review'
where r.code = 'content_admin'
on conflict (role_id, permission_id) do nothing;
