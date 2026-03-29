create extension if not exists "uuid-ossp";

create table if not exists public.roles (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  scope_type text,
  scope_id uuid,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists user_roles_active_scope_uniq
  on public.user_roles (
    user_id,
    role_id,
    coalesce(scope_type, ''),
    coalesce(scope_id::text, '')
  )
  where revoked_at is null;

insert into public.roles (code, name, description)
values
  ('user', 'Usuario', 'Usuario autenticado base'),
  ('author', 'Autor', 'Usuario habilitado para publicar y monetizar'),
  ('moderator', 'Moderador', 'Puede revisar reportes y moderar contenido'),
  ('admin', 'Admin', 'Puede operar el backoffice'),
  ('super_admin', 'Super Admin', 'Puede administrar acceso y operaciones sensibles')
on conflict (code) do nothing;

insert into public.permissions (code, name, description)
values
  ('profile.update_self', 'Editar perfil propio', 'Permite modificar el propio perfil'),
  ('content.create', 'Crear contenido', 'Permite crear publicaciones'),
  ('content.buy', 'Comprar contenido', 'Permite iniciar compras de contenido premium'),
  ('content.tip', 'Enviar propina', 'Permite iniciar propinas'),
  ('content.report', 'Reportar contenido', 'Permite denunciar contenido'),
  ('content.moderate', 'Moderar contenido', 'Permite revisar, archivar o eliminar contenido'),
  ('authors.apply', 'Solicitar autor', 'Permite enviar verificación de autor'),
  ('authors.review', 'Revisar autores', 'Permite aprobar o rechazar solicitudes de autor'),
  ('withdrawals.request', 'Solicitar retiros', 'Permite solicitar retiros'),
  ('withdrawals.review', 'Revisar retiros', 'Permite aprobar o rechazar retiros'),
  ('admin.access', 'Acceso admin', 'Permite entrar al panel admin'),
  ('admin.dashboard.read', 'Leer dashboard admin', 'Permite ver métricas y datasets del panel'),
  ('commissions.manage', 'Gestionar comisiones', 'Permite cambiar el reparto por usuario'),
  ('account.delete_self', 'Borrar cuenta propia', 'Permite borrar la propia cuenta'),
  ('dev.seed', 'Seed admin', 'Permite poblar datos demo en entornos no productivos')
on conflict (code) do nothing;

with mapping as (
  select 'user'::text as role_code, 'profile.update_self'::text as permission_code
  union all select 'user', 'content.buy'
  union all select 'user', 'content.tip'
  union all select 'user', 'content.report'
  union all select 'user', 'authors.apply'
  union all select 'user', 'account.delete_self'
  union all select 'author', 'content.create'
  union all select 'author', 'withdrawals.request'
  union all select 'moderator', 'content.moderate'
  union all select 'admin', 'admin.access'
  union all select 'admin', 'admin.dashboard.read'
  union all select 'admin', 'authors.review'
  union all select 'admin', 'withdrawals.review'
  union all select 'admin', 'commissions.manage'
  union all select 'admin', 'content.moderate'
  union all select 'super_admin', 'profile.update_self'
  union all select 'super_admin', 'content.create'
  union all select 'super_admin', 'content.buy'
  union all select 'super_admin', 'content.tip'
  union all select 'super_admin', 'content.report'
  union all select 'super_admin', 'content.moderate'
  union all select 'super_admin', 'authors.apply'
  union all select 'super_admin', 'authors.review'
  union all select 'super_admin', 'withdrawals.request'
  union all select 'super_admin', 'withdrawals.review'
  union all select 'super_admin', 'admin.access'
  union all select 'super_admin', 'admin.dashboard.read'
  union all select 'super_admin', 'commissions.manage'
  union all select 'super_admin', 'account.delete_self'
  union all select 'super_admin', 'dev.seed'
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from mapping m
join public.roles r on r.code = m.role_code
join public.permissions p on p.code = m.permission_code
on conflict do nothing;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated
on public.roles
for select
using (auth.role() = 'authenticated');

drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated
on public.permissions
for select
using (auth.role() = 'authenticated');

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated
on public.role_permissions
for select
using (auth.role() = 'authenticated');

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
on public.user_roles
for select
using (auth.uid() = user_id);
