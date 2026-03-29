# Viewer y User State Audit

## Estado actual

Hoy el store global útil quedó en:

- `auth`: sesión visible (`isAuthenticated`, `userId`, `email`)
- `viewer`: perfil, access y commerce
- `notifications`: inbox visible del usuario

El slice [viewerSlice.ts](/Users/devforce/Documents/GitHub/fanpush/lib/redux/slices/viewerSlice.ts) hoy guarda:

- `profile`: `username`, `avatarUrl`, `fullName`, `bio`, `website`, `instagram`
- `access`: `roles`, `permissions`, `authorStatus`, `isAuthor`, `isBlocked`, `isAdmin`, `canCreate`, `canWithdraw`, `canAccessAdmin`
- `commerce`: `balance`, `creatorShare`, `platformFee`, `payoutProfile`

La fuente de verdad cliente para eso es [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/me/route.ts).

## Qué datos realmente tenemos en backend / DB

Datos bien respaldados hoy:

- `auth.users`: identidad, email, password/sesión
- `public.users`: `id`, `username`, `avatar_url`, `bio`
- `public.profiles`: `full_name`, `email`
- `public.user_roles`, `roles`, `permissions`, `role_permissions` si las migraciones RBAC están aplicadas
- `authorStatus`: sale del workflow de `author_application`
- `balance`: sale de cálculo en backend, no de una columna única

Datos existentes pero mal modelados:

- `website` e `instagram`: salen de `notifications.type = profile_meta`
- `payoutProfile`: sale de `notifications.type = payout_profile`
- preferencias de notificación: salen de `notifications.type = notification_preferences`

Datos que hoy no están bien respaldados:

- `isBlocked`: en `/api/me` hoy está hardcodeado en `false`
- `badges`, `verified`, `featured`, `suspension_reason`, `kyc_level`
- summary estable de `followers`, `following`, `posts_count`, `sales_count`

## Conclusión

El `viewer` actual sirve para launch, pero todavía es un objeto corto y parcialmente derivado. El mayor límite no está en Redux sino en el modelo de datos: varias piezas de perfil/commerce siguen guardadas dentro de `notifications`.

## Recomendación

Orden correcto para endurecerlo:

1. Mantener `viewer` como contrato único cliente.
2. Mover `profile_meta` a columnas/tablas reales (`users` / `profiles`).
3. Mover `payout_profile` a `payout_profiles`.
4. Crear estado real de cuenta: `account_status`, `is_blocked`, `blocked_reason`.
5. Agregar un bloque `viewer.summary` con contadores y flags visibles.

Shape objetivo recomendado:

```ts
viewer = {
  profile: { username, avatarUrl, fullName, bio, website, instagram },
  summary: { followers, following, postsCount, salesCount },
  access: { roles, permissions, authorStatus, isAuthor, isBlocked, isAdmin },
  commerce: { balance, creatorShare, platformFee, payoutProfile },
  preferences: { notifications, locale },
}
```
