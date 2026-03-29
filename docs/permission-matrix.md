# Matriz de permisos

## Objetivo
Este documento propone una matriz explícita de acceso para rutas de UI y endpoints API. No describe cómo funciona hoy en todos los casos, sino cómo debería quedar el sistema ordenado.

## Roles
- `guest`
- `user`
- `author`
- `moderator`
- `admin`
- `super_admin`

## Permisos base
- `auth.public`
- `profile.read_self`
- `profile.update_self`
- `content.create`
- `content.read_premium_own`
- `content.read_premium_purchased`
- `content.buy`
- `content.tip`
- `content.report`
- `authors.apply`
- `authors.review`
- `withdrawals.request`
- `withdrawals.review`
- `admin.dashboard.read`
- `admin.access`
- `commissions.manage`
- `content.moderate`
- `account.delete_self`
- `dev.seed`

## Rutas UI

### Públicas
- `/auth` -> `guest`, `user`, `author`, `admin`
- `/terminos` -> público
- `/privacidad` -> público
- `/ayuda` -> público
- `/faq` -> público

### Autenticadas
- `/` -> `user+`
- `/explorar` -> `user+`
- `/perfil` -> `user+`
- `/settings` -> `user+`
- `/compras` -> `user+`
- `/ventas` -> `author+`
- `/user/[username]` -> `user+`
- `/checkout/return` -> `user+`

### Autor
- `/autor/solicitud` -> `user+`
- `/crear` -> `author+`

### Admin
- `/admin/login` -> público
- `/admin` -> `admin.dashboard.read` + `admin.access`

## API pública o webhook
- `POST /api/mercadopago/webhook` -> webhook firmado/seguro, no sesión de usuario

## API autenticada usuario

### Cuenta
- `POST /api/account/delete` -> `account.delete_self`

### Contenido
- `POST /api/posts/create` -> `content.create`
- `POST /api/media/access` -> `content.read_premium_own` o `content.read_premium_purchased` o ownership
- `POST /api/reports/content` -> `content.report`

### Autor
- `POST /api/author/apply` -> `authors.apply`

### Pagos
- `POST /api/mercadopago/preference` -> `content.buy` o `content.tip`
- `POST /api/mercadopago/finalize` -> usuario autenticado + ownership del pago

### Finanzas
- `POST /api/withdrawals/request` -> `withdrawals.request`

## API admin

### Acceso
- `GET /api/admin/access` -> `admin.access`
- `GET /api/admin/dashboard` -> `admin.dashboard.read`

### Usuarios y comisiones
- `PATCH /api/admin/users/[id]` -> `commissions.manage`

### Autores
- `PATCH /api/admin/authors/[id]` -> `authors.review`
- `DELETE /api/admin/authors/[id]` -> `authors.review`
- `POST /api/admin/authors/[id]` -> `authors.review`

### Retiros
- `PATCH /api/admin/withdrawals/[id]` -> `withdrawals.review`

### Reportes y moderación
- `PATCH /api/admin/reports/[id]` -> `content.moderate`
- `DELETE /api/admin/reports/[id]` -> `content.moderate`
- `POST /api/admin/reports/[id]` -> `content.moderate`
- `DELETE /api/admin/content/[albumId]` -> `content.moderate`
- `PATCH /api/admin/content/[albumId]` -> `content.moderate`
- `POST /api/admin/content/restore/[archiveId]` -> `content.moderate`

### Operaciones
- `POST /api/admin/dev/seed` -> `dev.seed` y sólo entorno no productivo

## Matriz resumida por actor

### `guest`
- puede abrir públicas
- no puede invocar APIs autenticadas

### `user`
- perfil propio
- compras
- propinas
- reportes
- solicitud de autor
- acceso a media comprada
- borrado de cuenta

### `author`
- todo `user`
- publicar contenido
- ventas
- retiros

### `moderator`
- revisar reportes
- moderar contenido
- restaurar contenido moderado

### `admin`
- todo `moderator`
- dashboard
- revisar autores
- revisar retiros
- gestionar comisiones

### `super_admin`
- todo
- seed y operaciones sensibles
- asignación de roles

## Checks adicionales por ownership
- un usuario no puede comprar su propio contenido
- un usuario no puede enviarse propina a sí mismo
- un usuario sólo puede borrar su cuenta
- un usuario sólo puede editar su perfil
- acceso premium sólo para dueño o comprador

## Recomendación de implementación
Cada endpoint debe exigir:
1. sesión válida
2. permiso requerido
3. ownership cuando aplique
4. checks funcionales del caso
