create table if not exists public.admin_action_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  target_type text not null,
  target_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_action_logs_actor_created_at_idx
  on public.admin_action_logs (actor_user_id, created_at desc);

create index if not exists admin_action_logs_target_created_at_idx
  on public.admin_action_logs (target_type, target_id, created_at desc);

alter table public.admin_action_logs enable row level security;

insert into public.roles (code, name, description)
values (
  'content_admin',
  'Admin de Moderacion',
  'Puede entrar al panel solo para revisar reportes y moderar contenido'
)
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('admin.access', 'admin.dashboard.read', 'content.moderate')
where r.code = 'content_admin'
on conflict do nothing;
