# Plan exhaustivo: autenticación, roles, rutas, tokens y permisos

## 1. Estado actual

### 1.1 Proveedor de identidad
La aplicación usa Supabase Auth como proveedor de identidad principal:
- registro por email + password
- login por email + password
- recuperación de contraseña
- sesión persistida en el browser

El token real que ya existe es el `access_token` JWT emitido por Supabase. Ese token hoy se manda como `Authorization: Bearer ...` a múltiples endpoints.

### 1.2 Cómo se resuelve hoy la sesión
Hay dos clientes browser:
- usuario normal: `getSupabaseClient()` con storage key `fanpush-user-auth`
- admin: `getSupabaseAdminBrowserClient()` con storage key `fanpush-admin-auth`

Esto crea dos “sesiones locales” distintas en navegador, pero ambas siguen siendo sesiones de Supabase. No existe un sistema de auth propio de backend.

### 1.3 Cómo se valida hoy en backend
El helper más importante es `getAuthenticatedUser(request)` en `lib/mercadopago.ts`.

Ese helper:
1. lee el bearer token
2. crea cliente server con service role
3. llama `admin.auth.getUser(accessToken)`
4. si la sesión es válida, devuelve `user`
5. además intenta asegurar filas en `users` y `profiles`

### 1.4 Problemas estructurales actuales
- la autenticación y autorización están mezcladas
- se usa un helper en `lib/mercadopago.ts` para cosas que no son de Mercado Pago
- el guard principal de páginas es cliente-side
- el guard cliente falla abierto si Supabase no está configurado
- la creación de `users/profiles` está duplicada entre trigger, helpers y pantallas
- admin no es un rol formal, sino una identidad inferida por email/username
- no existe una matriz de permisos explícita
- no existe un modelo central de ownership
- no existe `middleware.ts`
- no hay una capa única para SSR/server actions/routes

## 2. Principios recomendados

### 2.1 Separar identidad de autorización
- identidad: “quién eres”
- autorización: “qué puedes hacer”
- perfil de dominio: “qué entidad de negocio eres dentro del sistema”

### 2.2 Server-first
Toda decisión sensible debe resolverse en backend:
- acceso a admin
- creación de contenido
- acceso a media premium
- retiros
- revisión administrativa

### 2.3 Token único
Usar el JWT de Supabase como token oficial del sistema.

No recomiendo crear un JWT propio ahora porque:
- duplicaría sesiones
- aumentaría superficie de seguridad
- no resuelve el problema real, que hoy es autorización y modelo de permisos

Sólo convendría un token propio si luego:
- separan admin en otra app/servicio
- exponen APIs externas a terceros
- necesitan claims de dominio fuera del ecosistema Supabase

### 2.4 Roles persistidos
Los roles no deben vivir en `.env`. Deben vivir en base de datos.

### 2.5 Mínimo código repetido
Toda ruta debe usar helpers comunes, no reimplementar:
- lectura de token
- carga de usuario
- chequeo de roles
- ownership

## 3. Modelo recomendado de identidad y acceso

### 3.1 Capas

#### Capa 1: identidad
- `auth.users` de Supabase
- email
- password hash
- recuperación
- refresh/session lifecycle

#### Capa 2: usuario de aplicación
- `users`: perfil público
- `profiles`: perfil privado/base

#### Capa 3: acceso
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`

#### Capa 4: reglas de autorización
Helpers server:
- `requireAuth`
- `requirePermission`
- `requireRole`
- `requireAnyRole`
- `requireOwnership`
- `requireResourceAccess`

## 4. Tablas recomendadas para roles y permisos

### 4.1 `roles`
- `id`
- `code`
- `name`
- `description`
- `created_at`

Roles iniciales:
- `user`
- `author`
- `moderator`
- `admin`
- `super_admin`

### 4.2 `permissions`
- `id`
- `code`
- `name`
- `description`
- `created_at`

Permisos iniciales sugeridos:
- `auth.login`
- `profile.update_self`
- `content.create`
- `content.update_own`
- `content.delete_own`
- `content.buy`
- `content.report`
- `content.moderate`
- `withdrawals.request`
- `withdrawals.review`
- `authors.apply`
- `authors.review`
- `users.manage_commissions`
- `admin.dashboard.read`
- `admin.access`

### 4.3 `role_permissions`
- `role_id`
- `permission_id`
- unique(`role_id`, `permission_id`)

### 4.4 `user_roles`
- `user_id`
- `role_id`
- `scope_type` nullable
- `scope_id` nullable
- `granted_by`
- `created_at`

`scope_type/scope_id` sólo si luego quieren permisos por contexto.

## 5. Matriz recomendada de acceso

### 5.1 Invitado
Puede:
- ver páginas públicas
- registrarse
- iniciar sesión
- ver ayuda/privacidad/términos

No puede:
- acceder a feed privado
- crear contenido
- comprar
- propinar
- editar perfil
- reportar

### 5.2 Usuario autenticado
Puede:
- ver home autenticado
- editar perfil propio
- seguir usuarios
- reportar contenido
- comprar contenido
- enviar propinas
- gestionar cuenta

No puede:
- crear contenido premium sin rol autor
- revisar retiros
- moderar
- entrar a admin

### 5.3 Autor
Puede:
- todo lo de usuario autenticado
- crear publicaciones
- monetizar contenido
- ver ventas
- configurar cobros
- solicitar retiros

No puede:
- moderar
- administrar otros usuarios

### 5.4 Moderador
Puede:
- revisar reportes
- cambiar estado de moderación
- archivar/revisar/remover contenido

No necesariamente puede:
- ver finanzas
- editar comisiones
- revisar retiros

### 5.5 Admin
Puede:
- entrar a dashboard
- revisar retiros
- revisar solicitudes de autor
- gestionar comisiones
- ver panel operativo

### 5.6 Super admin
Puede:
- todo lo anterior
- asignar roles
- tocar configuraciones sensibles
- seed/operaciones de mantenimiento si siguen existiendo

## 6. Rutas: diseño propuesto

### 6.1 Públicas
- `/auth`
- `/terminos`
- `/privacidad`
- `/ayuda`
- `/faq`

### 6.2 Autenticadas
- `/`
- `/perfil`
- `/settings`
- `/compras`
- `/ventas`
- `/user/[username]`
- `/checkout/return`

### 6.3 Sólo autor
- `/crear`

### 6.4 Sólo admin/moderación
- `/admin`
- `/admin/**`

## 7. Guards recomendados por capa

### 7.1 `middleware.ts`
Objetivo:
- redirigir rápido
- evitar que el usuario vea UI que no corresponde
- mejorar UX

No debe ser la única defensa.

Debe cubrir:
- páginas autenticadas
- páginas admin
- páginas author-only

### 7.2 Guards de route handlers
Todos los endpoints sensibles deben llamar helpers server.

Ejemplo de familias:
- `POST /api/posts/create` => `requirePermission("content.create")`
- `POST /api/withdrawals/request` => `requirePermission("withdrawals.request")`
- `PATCH /api/admin/withdrawals/:id` => `requirePermission("withdrawals.review")`
- `PATCH /api/admin/authors/:id` => `requirePermission("authors.review")`

### 7.3 Guards de ownership
Casos:
- editar perfil propio
- borrar cuenta propia
- ver media premium propia
- comprar sobre recursos ajenos

Ejemplo:
- `requireOwnership(currentUser.id, profileUserId)`

## 8. Casos por funcionalidad

### 8.1 Registro
Estado actual:
- registro directo con Supabase Auth
- metadata: `full_name`, `username`, términos

Problemas:
- validación de dominio repartida
- no hay post-registro centralizado

Recomendación:
- trigger crea `users/profiles`
- backend completa defaults si falta algo
- frontend no hace upserts estructurales

### 8.2 Login usuario
Estado actual:
- `signInWithPassword`
- si hay sesión, redirige

Problema:
- basta con sesión, aunque el dominio no esté ordenado

Recomendación:
- login sólo crea sesión
- `ensureAppUser()` se ejecuta una vez server-side
- home y APIs consumen usuario ya normalizado

### 8.3 Login admin
Estado actual:
- usa otro storage key
- chequea `/api/admin/access`

Problema:
- admin se resuelve por env, no por rol

Recomendación:
- unificar sesión
- resolver acceso por permiso `admin.access`

### 8.4 Crear contenido
Estado actual:
- autenticación sí
- autorización “autor” no centralizada

Recomendación:
- bloquear `/crear`
- bloquear `POST /api/posts/create`
- exigir permiso `content.create`

### 8.5 Comprar contenido
Estado actual:
- sesión válida
- no compra propio contenido

Recomendación:
- permiso `content.buy`
- ownership explícito sobre recurso comprador vs dueño

### 8.6 Acceso a media premium
Estado actual:
- backend correcto: dueño o comprador accede a signed URL

Recomendación:
- mantener esta lógica
- moverla fuera de `lib/mercadopago.ts`
- formalizar helper `canAccessPostMedia(userId, postId)`

### 8.7 Solicitud de autor
Estado actual:
- cualquier autenticado puede aplicar
- admin revisa

Recomendación:
- permiso `authors.apply`
- tabla dedicada
- transición de estado validada

### 8.8 Retiros
Estado actual:
- sesión válida
- perfil de cobro obligatorio
- una solicitud por mes
- mínimo ARS 50.000

Recomendación:
- permiso `withdrawals.request`
- tabla dedicada
- historial separado

### 8.9 Moderación
Estado actual:
- sólo admin
- basado en `notifications`

Recomendación:
- separar `moderator` de `admin`
- permisos finos
- historial/auditoría estructurada

## 9. Refactor técnico sugerido

### 9.1 Renombrar módulos
Sacar auth de `lib/mercadopago.ts`.

Crear:
- `lib/server/auth/session.ts`
- `lib/server/auth/authorization.ts`
- `lib/server/auth/app-user.ts`
- `lib/server/admin/access.ts`

### 9.2 Helpers propuestos
- `getServerSupabaseAdmin()`
- `getAccessTokenFromRequest()`
- `getCurrentAuthUser(request)`
- `ensureAppUser(admin, authUser)`
- `getCurrentAppUser(request)`
- `hasRole(userId, roleCode)`
- `hasPermission(userId, permissionCode)`
- `requireAuth(request)`
- `requirePermission(request, code)`

### 9.3 Estructura final sugerida
- `lib/server/auth/*`
- `lib/server/repositories/*`
- `lib/server/use-cases/*`
- `lib/server/policies/*`

## 10. Plan de migración por fases

### Fase 1: hardening inmediato
- cerrar `AuthGate` fail-open
- extraer `getAuthenticatedUser` a módulo auth
- crear `requireAuth`
- crear `middleware.ts`

### Fase 2: access model
- agregar tablas de roles/permisos
- seed de roles base
- asignar `admin` a quienes hoy están por env
- migrar `isAdminUser`

### Fase 3: authorización funcional
- proteger `/crear`
- proteger retiros
- proteger admin por permisos

### Fase 4: limpieza
- eliminar storage key admin separada si no aporta valor
- eliminar upserts duplicados de `users/profiles`
- centralizar bootstrap de usuario

### Fase 5: claims opcionales
Sólo si luego hace falta performance:
- añadir claims calculadas a JWT o cache de permisos
- no hacerlo antes

## 11. Recomendaciones concretas

### Sí recomiendo
- usar JWT de Supabase
- agregar roles/permisos en BD
- middleware + backend guards
- unificar authz server-side

### No recomiendo ahora
- emitir JWT propio
- separar auth en microservicio
- separar admin a otro repo antes de estabilizar permisos y datos

## 12. Conclusión
El problema principal no es falta de JWT, porque el JWT ya existe. El problema es que el sistema no tiene un modelo ordenado de autorización. La prioridad es pasar de “sesión válida = acceso” a “sesión válida + rol/permisos/ownership = acceso autorizado”.
