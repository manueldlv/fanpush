# SQL Operations Guide

## Objetivo
Runbook para operaciones que hoy no tienen interfaz en la app y conviene ejecutar por SQL directamente en la base.

Usar en:
- Supabase SQL Editor
- `psql` contra la misma base

No usar este documento para:
- crear usuarios manualmente en `auth.users`
- tocar contraseñas
- editar `auth.users.encrypted_password`

Las cuentas deben crearse por signup normal, Dashboard de Supabase o Admin API. Después, por SQL solo se asignan o corrigen roles y datos de soporte.

## Pre-requisitos
Aplicar estas migraciones en este orden:
- [20260328_000001_access_control.sql](/Users/devforce/Documents/GitHub/fanpush/supabase/migrations/20260328_000001_access_control.sql)
- [20260328_000002_default_user_role.sql](/Users/devforce/Documents/GitHub/fanpush/supabase/migrations/20260328_000002_default_user_role.sql)
- [20260328_000003_roles_manage_permission.sql](/Users/devforce/Documents/GitHub/fanpush/supabase/migrations/20260328_000003_roles_manage_permission.sql)

## 1. Verificar que el usuario existe
```sql
select id, email, email_confirmed_at, created_at
from auth.users
where lower(email) = lower('tu-email@dominio.com');
```

## 2. Ver roles actuales de un usuario
```sql
select
  au.email,
  r.code as role_code,
  ur.created_at,
  ur.revoked_at
from auth.users au
join public.user_roles ur on ur.user_id = au.id
join public.roles r on r.id = ur.role_id
where lower(au.email) = lower('tu-email@dominio.com')
order by r.code, ur.created_at desc;
```

## 3. Dar el primer `super_admin`
```sql
insert into public.user_roles (user_id, role_id, granted_by)
select au.id, r.id, au.id
from auth.users au
join public.roles r on r.code = 'super_admin'
where lower(au.email) = lower('tu-email@dominio.com')
on conflict do nothing;
```

## 4. Dar o quitar roles admin
Dar `admin`:
```sql
insert into public.user_roles (user_id, role_id, granted_by)
select au.id, r.id, au.id
from auth.users au
join public.roles r on r.code = 'admin'
where lower(au.email) = lower('tu-email@dominio.com')
on conflict do nothing;
```

Dar `moderator`:
```sql
insert into public.user_roles (user_id, role_id, granted_by)
select au.id, r.id, au.id
from auth.users au
join public.roles r on r.code = 'moderator'
where lower(au.email) = lower('tu-email@dominio.com')
on conflict do nothing;
```

Revocar un rol:
```sql
update public.user_roles ur
set revoked_at = now()
from auth.users au, public.roles r
where ur.user_id = au.id
  and ur.role_id = r.id
  and ur.revoked_at is null
  and lower(au.email) = lower('tu-email@dominio.com')
  and r.code = 'admin';
```

## 5. Backfill del rol base `user`
Para cuentas viejas creadas antes de la migración:
```sql
insert into public.user_roles (user_id, role_id, granted_by)
select au.id, r.id, au.id
from auth.users au
join public.roles r on r.code = 'user'
on conflict do nothing;
```

## 6. Backfill del rol `author` desde solicitudes aprobadas
Dar `author` a usuarios cuya última solicitud esté aprobada:
```sql
with latest_author_application as (
  select distinct on (n.user_id)
    n.user_id,
    replace(n.message, 'author_application:', '')::jsonb as payload
  from public.notifications n
  where n.type = 'author_application'
  order by n.user_id, n.created_at desc
)
insert into public.user_roles (user_id, role_id, granted_by)
select laa.user_id, r.id, laa.user_id
from latest_author_application laa
join public.roles r on r.code = 'author'
where laa.payload ->> 'status' = 'approved'
on conflict do nothing;
```

Revocar `author` a usuarios cuya última solicitud ya no esté aprobada:
```sql
with latest_author_application as (
  select distinct on (n.user_id)
    n.user_id,
    replace(n.message, 'author_application:', '')::jsonb as payload
  from public.notifications n
  where n.type = 'author_application'
  order by n.user_id, n.created_at desc
)
update public.user_roles ur
set revoked_at = now()
from public.roles r
left join latest_author_application laa on laa.user_id = ur.user_id
where ur.role_id = r.id
  and r.code = 'author'
  and ur.revoked_at is null
  and coalesce(laa.payload ->> 'status', '') <> 'approved';
```

## 7. Reparar bootstrap de `public.users` y `public.profiles`
Si existen usuarios en `auth.users` pero faltan filas públicas:
```sql
insert into public.users (id, username, created_at)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  now()
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;
```

```sql
insert into public.profiles (id, full_name, email, created_at)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'full_name', ''),
  au.email,
  now()
from auth.users au
left join public.profiles pp on pp.id = au.id
where pp.id is null
on conflict (id) do nothing;
```

## 8. Auditoría rápida de roles activos
```sql
select
  au.email,
  array_agg(r.code order by r.code) as active_roles
from auth.users au
join public.user_roles ur on ur.user_id = au.id and ur.revoked_at is null
join public.roles r on r.id = ur.role_id
group by au.id, au.email
order by au.email;
```

## 9. Catálogo de permisos por rol
```sql
select
  r.code as role_code,
  p.code as permission_code
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
order by r.code, p.code;
```

## 10. Cierre de migración
Cuando ya exista al menos un `super_admin` real y los roles estén cargados:
- activar `AUTH_ENFORCE_PERSISTED_ROLES=true`
- dejar de depender de `ADMIN_EMAILS` y `ADMIN_USERNAMES`

## Notas operativas
- `admin`, `moderator` y `super_admin` son roles adicionales sobre la misma identidad de usuario.
- Un admin puede seguir siendo usuario normal y también autor.
- Si una cuenta ya existe, no cambies password por SQL. La password la gestiona Supabase Auth.
