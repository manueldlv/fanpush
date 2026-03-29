# SQL target schema

## Objetivo
Este documento propone el schema objetivo para FanPush. No es todavía una migración ejecutable final, sino una especificación de diseño para:
- ordenar dominios
- separar auth, negocio y admin
- sacar estado operativo de `notifications`
- preparar RLS y permisos

## Principios
- `auth.users` sigue siendo la fuente de identidad
- el perfil de dominio se separa en público y privado
- roles/permisos viven en tablas propias
- estados operativos críticos usan tablas estructuradas
- `notifications` queda como inbox/eventos visibles al usuario
- toda tabla sensible debe tener `created_at`, y cuando aplique `updated_at`

## Extensiones

```sql
create extension if not exists "uuid-ossp";
```

## 1. Identidad y perfil

### 1.1 `public.users`
Perfil público y social.

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  bio text,
  website text,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Índices:

```sql
create unique index users_username_lower_uniq on public.users (lower(username));
```

### 1.2 `public.profiles`
Perfil privado/base del usuario.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  country text,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 1.3 Trigger de bootstrap
Debe existir una única vía automática de bootstrap.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (
    id,
    username
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id,
    full_name,
    email
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
```

## 2. Acceso, roles y permisos

### 2.1 `public.roles`

```sql
create table public.roles (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
```

### 2.2 `public.permissions`

```sql
create table public.permissions (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
```

### 2.3 `public.role_permissions`

```sql
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
```

### 2.4 `public.user_roles`

```sql
create table public.user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  scope_type text,
  scope_id uuid,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, role_id, scope_type, scope_id)
);
```

Observación:
- `scope_type/scope_id` se pueden dejar nulos si no se usan aún

## 3. Social graph

### 3.1 `public.follows`

```sql
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
```

Índices:

```sql
create index follows_following_id_idx on public.follows (following_id);
```

### 3.2 `public.likes`

```sql
create table public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
```

## 4. Contenido

### 4.1 `public.albums`

```sql
create table public.albums (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text,
  price numeric(12,2) not null default 0,
  visibility text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price >= 0),
  check (visibility in ('draft', 'published', 'archived', 'removed'))
);
```

Índices:

```sql
create index albums_user_id_created_at_idx on public.albums (user_id, created_at desc);
```

### 4.2 `public.posts`

```sql
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  media_type text not null,
  is_locked boolean not null default false,
  likes_count integer not null default 0,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_type in ('image', 'video'))
);
```

Índices:

```sql
create index posts_user_id_created_at_idx on public.posts (user_id, created_at desc);
```

### 4.3 `public.album_posts`

```sql
create table public.album_posts (
  album_id uuid not null references public.albums(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (album_id, post_id)
);
```

## 5. Monetización

## 5.1 Modelo mínimo compatible

### `public.purchases`

```sql
create table public.purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  payment_id text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  check (amount >= 0),
  check (status in ('approved', 'refunded', 'cancelled'))
);
```

Índices:

```sql
create unique index purchases_payment_id_post_id_uniq
  on public.purchases (payment_id, post_id);

create index purchases_user_id_created_at_idx
  on public.purchases (user_id, created_at desc);

create index purchases_post_id_created_at_idx
  on public.purchases (post_id, created_at desc);
```

## 5.2 Modelo recomendado a futuro
Si luego quieren algo más sólido:
- `payments`
- `orders`
- `order_items`
- `tips`

Por ahora puede convivir `purchases` mientras el flujo se mantenga simple.

## 6. Creator operations

### 6.1 `public.author_applications`

```sql
create table public.author_applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  full_name text not null,
  birth_date date not null,
  document_type text not null,
  document_number text not null,
  country text not null,
  province text not null,
  city text not null,
  address text not null,
  document_front_url text not null,
  document_back_url text not null,
  rejection_reason text,
  archived_at timestamptz,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('pending', 'approved', 'rejected'))
);
```

Índices:

```sql
create index author_applications_user_id_idx on public.author_applications (user_id);
create index author_applications_status_idx on public.author_applications (status);
```

### 6.2 `public.author_application_history`

```sql
create table public.author_application_history (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references public.author_applications(id) on delete cascade,
  action text not null,
  reason text,
  actor_id uuid not null references auth.users(id),
  acted_at timestamptz not null default now(),
  check (action in ('submitted', 'approved', 'rejected', 'archived', 'restored'))
);
```

### 6.3 `public.payout_profiles`

```sql
create table public.payout_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  alias text not null,
  holder_name text not null,
  holder_document text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 6.4 `public.user_commission_profiles`

```sql
create table public.user_commission_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_share numeric(5,4) not null,
  platform_share numeric(5,4) not null,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (creator_share >= 0 and creator_share <= 1),
  check (platform_share >= 0 and platform_share <= 1),
  check (round((creator_share + platform_share)::numeric, 4) = 1.0000)
);
```

Índice:

```sql
create index user_commission_profiles_user_id_created_at_idx
  on public.user_commission_profiles (user_id, created_at desc);
```

### 6.5 `public.withdrawal_requests`

```sql
create table public.withdrawal_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payout_profile_id uuid references public.payout_profiles(id),
  amount numeric(12,2) not null,
  status text not null default 'requested',
  month_key text not null,
  reason text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount >= 0),
  check (status in ('requested', 'sent', 'rejected'))
);
```

Índices:

```sql
create index withdrawal_requests_user_id_created_at_idx
  on public.withdrawal_requests (user_id, created_at desc);

create unique index withdrawal_requests_user_id_month_key_open_uniq
  on public.withdrawal_requests (user_id, month_key)
  where status = 'requested';
```

### 6.6 `public.withdrawal_history`

```sql
create table public.withdrawal_history (
  id uuid primary key default uuid_generate_v4(),
  withdrawal_request_id uuid not null references public.withdrawal_requests(id) on delete cascade,
  status text not null,
  amount numeric(12,2) not null,
  actor_id uuid not null references auth.users(id),
  reason text,
  acted_at timestamptz not null default now(),
  check (status in ('requested', 'sent', 'rejected'))
);
```

## 7. Trust & safety

### 7.1 `public.content_reports`

```sql
create table public.content_reports (
  id uuid primary key default uuid_generate_v4(),
  album_id uuid not null references public.albums(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open',
  archived boolean not null default false,
  reported_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('open', 'reviewed', 'dismissed', 'removed'))
);
```

Índices:

```sql
create index content_reports_album_id_idx on public.content_reports (album_id);
create index content_reports_status_idx on public.content_reports (status);
```

### 7.2 `public.moderation_actions`

```sql
create table public.moderation_actions (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid references public.content_reports(id) on delete set null,
  album_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null,
  reason text,
  acted_at timestamptz not null default now(),
  check (action in ('reviewed', 'dismissed', 'removed', 'restored', 'archived'))
);
```

### 7.3 `public.moderation_archives`

```sql
create table public.moderation_archives (
  id uuid primary key default uuid_generate_v4(),
  album_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  archived_payload jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by uuid not null references auth.users(id)
);
```

Observación:
- este es uno de los pocos casos donde `jsonb` sí es razonable
- sirve para snapshot de contenido removido

## 8. Inbox y notificaciones visibles

### 8.1 `public.notifications`

```sql
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_id uuid,
  type text not null,
  title text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
```

Tipos recomendados para conservar aquí:
- `follow`
- `purchase`
- `tip`
- `author_application_update`
- `withdrawal_update`
- `content_removed_update`

No deberían seguir aquí:
- author applications
- withdrawal requests
- commission profiles
- content reports
- moderation state/history

Índices:

```sql
create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_id_is_read_idx
  on public.notifications (user_id, is_read);
```

## 9. Auditoría transversal

### 9.1 `public.audit_logs`

```sql
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Uso recomendado:
- revisiones admin
- cambios de comisión
- cambios de roles
- restauraciones
- borrados lógicos/duros relevantes

## 10. RLS: lineamientos

## 10.1 `users`
- `select`: público autenticado o incluso público total según producto
- `update`: sólo propio usuario
- `insert`: sólo trigger/backend

## 10.2 `profiles`
- `select`: sólo propio usuario
- `update`: sólo propio usuario
- `insert`: trigger/backend

## 10.3 `follows`
- `select`: autenticados
- `insert/delete`: sólo quien actúa como `follower_id`

## 10.4 `likes`
- `insert/delete/select`: sólo autenticados; `user_id = auth.uid()` para write

## 10.5 `albums/posts`
- `select`: según visibilidad
- `insert/update/delete`: sólo owner o backend con service role

## 10.6 `purchases`
- `select`: sólo comprador; opcional lectura backend para dueño vía joins o RPC
- `insert`: sólo backend

## 10.7 `author_applications`
- `select`: propio usuario y admins
- `insert/update`: propio usuario cuando está creando/actualizando
- `review`: sólo admins/moderadores habilitados vía backend

## 10.8 `withdrawal_requests`
- `select`: dueño y admins
- `insert`: dueño
- `review`: backend admin

## 10.9 `notifications`
- `select/update`: sólo dueño
- `insert`: backend y algunos casos cliente controlados si lo permiten

## 11. Orden de migración recomendado

### Etapa 1
- crear tablas de roles/permisos
- crear `audit_logs`

### Etapa 2
- crear tablas nuevas de `author_applications`, `withdrawal_requests`, `content_reports`

### Etapa 3
- adaptar backend a escribir en tablas nuevas y seguir duplicando a `notifications` temporalmente

### Etapa 4
- migrar lecturas admin al nuevo modelo

### Etapa 5
- limpiar `notifications`

## 12. Conclusión
Este schema objetivo deja una arquitectura mucho más clara:
- Supabase Auth para identidad
- tablas propias para roles/permisos
- tablas dedicadas para dominio administrativo
- `notifications` como inbox real
- `audit_logs` para trazabilidad

Es el paso correcto antes de escribir migraciones definitivas.
