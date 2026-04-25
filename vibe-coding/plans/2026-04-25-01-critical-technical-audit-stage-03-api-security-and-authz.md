# Audit Stage Report

## Metadata

- `plan_id`: `2026-04-25-01-critical-technical-audit`
- `stage_id`: `stage-03`
- `title`: `Seguridad, autenticacion y autorizacion de APIs`
- `status`: `completed`
- `owner`: `vibe-agent`
- `date`: `2026-04-25`
- `domains_covered`: `auth`, `authz`, `admin`, `payments`, `media access`, `withdrawals`, `direct-chats`

## Objective

Verificar si los endpoints sensibles aplican autenticación, autorización por recurso y validaciones de entrada de forma consistente y defendible.

## Review Method

Se revisaron:

- helpers `getAuthenticatedUser`, `requireAdminAccess`, `requireAuthorPermission`
- rutas `app/api/admin/**`
- pagos `mercadopago/finalize` y `mercadopago/webhook`
- acceso a media protegida
- retiro de fondos
- operaciones de chat directo
- borrado/archivado de cuenta

El foco fue detectar:

- permisos basados en fuentes ambiguas
- endpoints que confían demasiado en datos externos
- mutaciones sensibles con alcance `admin` sin hardening suficiente

## Evidence Map

- `lib/server/auth/session.ts`
- `lib/server/auth/authorization.ts`
- `lib/server/auth/roles.ts`
- `lib/admin.ts`
- `app/api/mercadopago/webhook/route.ts`
- `app/api/media/access/route.ts`
- `app/api/withdrawals/request/route.ts`
- `app/api/direct-chats/threads/[id]/messages/route.ts`
- `app/api/account/delete/route.ts`
- `app/api/admin/users/[id]/roles/route.ts`

## Critical Findings

### Finding

- `id`: `SEC-P0-01`
- `severity`: `P0`
- `domain`: `payments`
- `title`: `El webhook de Mercado Pago procesa pagos sin validar firma, origen ni tipo de evento`
- `files`:
  - `app/api/mercadopago/webhook/route.ts:5`
  - `app/api/mercadopago/webhook/route.ts:29`
  - `lib/mercadopago.ts:91`
- `routes`:
  - `POST /api/mercadopago/webhook`
- `data_surfaces`:
  - `ledger_transactions`
  - `purchases`
  - `notifications`
  - `user_balances`
- `business_rule`: `solo Mercado Pago deberia poder gatillar acreditaciones server-to-server`
- `evidence`: `el webhook toma `paymentId` desde query o body y llama `finalizeMercadoPagoPayment` sin verificar firma HMAC, headers del proveedor, tipo de evento ni correlación con una preferencia emitida por el sistema.`
- `risk`: `cualquier actor capaz de hacer POST al endpoint con un payment id válido podría forzar reintentos o intentar gatillar acreditaciones externas.`
- `why_it_is_critical`: `es una frontera de dinero expuesta a internet y hoy no tiene autenticación propia del proveedor.`

### Finding

- `id`: `SEC-P1-02`
- `severity`: `P1`
- `domain`: `media-access`
- `title`: `El endpoint de acceso a media devuelve URLs públicas para cualquier post solicitado aunque el usuario no tenga relación con ese recurso`
- `files`:
  - `app/api/media/access/route.ts:22`
  - `app/api/media/access/route.ts:29`
  - `app/api/media/access/route.ts:98`
- `routes`:
  - `POST /api/media/access`
- `data_surfaces`:
  - `posts`
  - buckets `PUBLIC_MEDIA_BUCKET` y `PREMIUM_MEDIA_BUCKET`
- `business_rule`: `el acceso mediado deberia resolver solo recursos que el usuario puede consultar por contexto de producto`
- `evidence`: `el endpoint acepta una lista arbitraria de `postIds`, los busca con `admin`, y para recursos no premium devuelve siempre `publicUrl` aunque no haya validación de ownership, follow, visibilidad de álbum ni pertenencia al flujo que hizo el request.`
- `risk`: `sirve como oracle de enumeración de posts y de resolución de media para IDs arbitrarios, ampliando el alcance de scraping y de acceso indirecto a contenido.`
- `why_it_is_critical`: `el endpoint centraliza acceso a contenido; si no limita el universo consultable, la autorización real queda reducida al carácter público del bucket, no al producto.`

### Finding

- `id`: `SEC-P1-03`
- `severity`: `P1`
- `domain`: `authz`
- `title`: `La autorización admin sigue apoyándose en identidad legacy por email/username además de roles persistidos`
- `files`:
  - `lib/admin.ts:17`
  - `lib/server/auth/roles.ts:135`
  - `lib/server/auth/roles.ts:214`
  - `lib/server/auth/authorization.ts:8`
- `routes`:
  - `app/api/admin/**`
- `data_surfaces`:
  - `ADMIN_EMAILS`
  - `ADMIN_USERNAMES`
  - `roles`
  - `user_roles`
- `business_rule`: `el acceso admin deberia decidirse desde una sola autoridad persistida`
- `evidence`: `requireAdminAccess` depende de `hasPermission`, pero `hasPermission` y `getUserAccessSnapshot` pueden caer en `isAdminUser` cuando no se exige persistencia estricta.`
- `risk`: `el mismo usuario puede ser admin por configuración legacy aunque sus roles persistidos no lo reflejen, o viceversa.`
- `why_it_is_critical`: `en endpoints admin, una regla dual de autorización complica la revisión de seguridad y puede introducir bypasses involuntarios durante migraciones.`

### Finding

- `id`: `SEC-P1-04`
- `severity`: `P1`
- `domain`: `account-delete`
- `title`: `El archivado de cuenta ejecuta una secuencia destructiva larga con privilegios admin y sin frontera transaccional`
- `files`:
  - `app/api/account/delete/route.ts:8`
  - `app/api/account/delete/route.ts:31`
  - `app/api/account/delete/route.ts:76`
- `routes`:
  - `POST /api/account/delete`
- `data_surfaces`:
  - `notifications`
  - `follows`
  - `likes`
  - `purchases`
  - `notification_threads`
  - `user_meta`
  - `user_roles`
  - `users`
  - `profiles`
  - `auth.users`
- `business_rule`: `el cierre de cuenta no deberia dejar el sistema en un estado parcial`
- `evidence`: `la ruta borra/actualiza múltiples tablas y recién al final modifica `auth.users`; no hay rollback visible ni mecanismo de compensación si falla una etapa intermedia.`
- `risk`: `una cuenta puede quedar parcialmente archivada: sin follows o notifications pero con credenciales activas, o con perfil anonimizado pero relaciones residuales.`
- `why_it_is_critical`: `es una operación irreversible y multi-entidad; la seguridad no es solo auth sino también garantizar integridad al ejecutar acciones destructivas.`

## Cross-System Inconsistencies

- la autenticación siempre pasa por `getAuthenticatedUser`, pero eso también muta estado persistente de usuario/roles;
- la autorización admin mezcla permisos persistidos con identidad legacy por email/username;
- algunos flujos sensibles usan endpoints server-side; otros acceden tablas directamente desde cliente con RLS.

## Open Questions

- Si existe verificación de webhook a nivel infraestructura externa y no en la app.
- Si `AUTH_ENFORCE_PERSISTED_ROLES` está activo en producción o si hoy sigue rigiendo el fallback legacy.

## Stage Exit

Los dos riesgos más severos de seguridad son:

- webhook de pagos sin autenticación del proveedor
- autorización admin con doble fuente de verdad

La siguiente etapa se centra en integridad de persistencia, porque varios de estos endpoints además escriben en muchas superficies sin atomicidad visible.
