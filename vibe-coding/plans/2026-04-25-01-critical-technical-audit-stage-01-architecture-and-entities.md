# Audit Stage Report

## Metadata

- `plan_id`: `2026-04-25-01-critical-technical-audit`
- `stage_id`: `stage-01`
- `title`: `Arquitectura, dominios y entidades persistentes`
- `status`: `completed`
- `owner`: `vibe-agent`
- `date`: `2026-04-25`
- `domains_covered`: `auth`, `roles`, `posts`, `albums`, `purchases`, `ledger`, `withdrawals`, `notification-center`, `direct-chats`, `admin`

## Objective

Delimitar la superficie real del sistema antes de auditar estados, seguridad y persistencia. La meta de esta etapa fue identificar:

- dominios funcionales y sus puntos de entrada
- entidades persistentes y tablas sensibles
- rutas API con capacidad de mutacion
- helpers server-side que concentran reglas criticas
- zonas donde ya se ve riesgo estructural de inconsistencia

## Review Method

Se cruzo la informacion de estas capas:

- arbol de rutas `app/` y `app/api/**`
- `lib/server/auth/*` para autenticacion, autorizacion y bootstrap de identidad
- `lib/server/repositories/*` para reglas de dinero, compras, mensajes y backoffice
- `lib/redux/*` para ubicar la orquestacion cliente
- migraciones `supabase/migrations/*` para derivar el modelo persistente real

Se siguio este criterio:

1. enumerar dominios visibles desde UI y API
2. mapear cada dominio a sus repositorios server-side
3. identificar tablas base y tablas derivadas
4. detectar desde la arquitectura misma puntos donde una misma regla ya aparece repartida entre mas de una capa

## Evidence Map

### Rutas UI principales

- `app/page.tsx`
- `app/explorar/page.tsx`
- `app/perfil/page.tsx`
- `app/crear/page.tsx`
- `app/compras/page.tsx`
- `app/ventas/page.tsx`
- `app/saldo/page.tsx`
- `app/mensajes/page.tsx`
- `app/notificaciones/page.tsx`
- `app/settings/page.tsx`
- `app/admin/page.tsx`

### Endpoints con mutacion o acceso sensible

- `app/api/auth/register/route.ts`
- `app/api/account/delete/route.ts`
- `app/api/balance/checkout/route.ts`
- `app/api/mercadopago/preference/route.ts`
- `app/api/mercadopago/finalize/route.ts`
- `app/api/mercadopago/webhook/route.ts`
- `app/api/posts/create/route.ts`
- `app/api/withdrawals/request/route.ts`
- `app/api/withdrawals/[id]/cancel/route.ts`
- `app/api/direct-chats/messages/[id]/purchase/route.ts`
- `app/api/direct-chats/threads/[id]/messages/route.ts`
- `app/api/direct-chats/threads/[id]/actions/route.ts`
- `app/api/admin/**`

### Helpers y repositorios criticos

- `lib/server/auth/session.ts`
- `lib/server/auth/roles.ts`
- `lib/server/repositories/payments.ts`
- `lib/server/repositories/ledger.ts`
- `lib/server/repositories/direct-chats.ts`
- `lib/server/repositories/notification-center.ts`
- `lib/server/repositories/withdrawals.ts`

### Entidades persistentes visibles en migraciones

- identidad y perfil:
  `users`, `profiles`, `follows`
- contenido:
  `albums`, `posts`, `album_posts`, `likes`, `purchases`
- notificaciones:
  `notifications`, `notification_threads`, `notification_messages`
- finanzas:
  `user_commission_profiles`, `user_balances`, `ledger_transactions`, `ledger_entries`, `withdrawal_requests`, `provider_movements`
- mensajeria directa:
  `direct_threads`, `direct_thread_members`, `direct_messages`, `direct_message_purchases`, `direct_user_blocks`
- authz:
  tablas de roles y permisos inferidas por `lib/server/auth/roles.ts`

## Architecture Map

### 1. Shell de aplicacion

El layout global monta `AppProviders` y `AppChrome`, con una mezcla de Redux slices y RTK Query como capa cliente principal. La navegacion y varias pantallas dependen de fetches custom y no de una unica infraestructura de datos.

### 2. Capa server-side

La capa server no es uniforme. Conviven:

- route handlers en `app/api/**`
- helpers de auth en `lib/server/auth/*`
- repositorios con reglas de negocio en `lib/server/repositories/*`
- funciones auxiliares de dominio en `lib/*`
- RPCs y funciones SQL en Supabase

Esto implica que una regla puede vivir en route handler, repositorio, helper de dominio o SQL, segun el flujo.

### 3. Modelo persistente

El sistema esta organizado alrededor de cuatro nucleos:

- identidad y acceso
- contenido y compras
- ledger y balance
- mensajeria / notificacion

Las compras y propinas tocan mas de un nucleo a la vez: contenido, ledger, balances, notificaciones y a veces chat.

### 4. Flujos de alto riesgo ya identificados

- compra con saldo interno
- compra con Mercado Pago y posterior finalize/webhook
- propinas internas y externas
- desbloqueo premium por chat
- retiros y reservas de balance
- elevacion o lectura de roles admin

## Critical Findings

### Finding

- `id`: `ARCH-P2-01`
- `severity`: `P2`
- `domain`: `auth`
- `title`: `La autenticacion server-side mezcla validacion de sesion con bootstrap mutable de usuarios y roles`
- `files`:
  - `lib/server/auth/session.ts:38`
  - `lib/server/auth/session.ts:118`
  - `lib/server/auth/roles.ts:83`
- `routes`:
  - `app/api/**` que usan `getAuthenticatedUser`
- `data_surfaces`:
  - `users`
  - `profiles`
  - `user_roles`
- `business_rule`: `autenticar al usuario no deberia redefinir ni completar silenciosamente el modelo de cuenta en cada request`
- `evidence`: `getAuthenticatedUser` no solo valida el bearer token; tambien llama `ensureServerUserRows` y luego `grantRoleByCode(admin, user.id, "user", user.id)` en cada request autenticado.`
- `risk`: `cualquier endpoint autenticado puede fallar por problemas de bootstrap de perfil/rol; ademas auth y mutacion de identidad quedan acoplados y dificiles de razonar o aislar.`
- `why_it_is_critical`: `esto convierte la frontera de seguridad en una rutina con side effects persistentes. Aumenta el radio de falla de todo el backend y vuelve ambiguo si un error es de sesion, de datos publicos o de asignacion de roles.`

### Finding

- `id`: `ARCH-P2-02`
- `severity`: `P2`
- `domain`: `authz`
- `title`: `El modelo de permisos mezcla roles persistidos con fallback legacy admin en tiempo de lectura`
- `files`:
  - `lib/server/auth/roles.ts:135`
  - `lib/server/auth/roles.ts:181`
- `routes`:
  - `app/api/admin/**`
- `data_surfaces`:
  - `user_roles`
  - `roles`
  - `role_permissions`
  - fuente legacy evaluada por `isAdminUser`
- `business_rule`: `la condicion de admin deberia resolverse desde una sola fuente de verdad`
- `evidence`: `hasRole` y `getUserAccessSnapshot` primero intentan leer roles persistidos, pero si no alcanza o no se exige persistencia usan `isAdminUser` y hasta asignan rol admin en runtime.`
- `risk`: `la autorizacion puede variar segun el estado de las tablas de roles, la variable `AUTH_ENFORCE_PERSISTED_ROLES` y la ruta de codigo que consulte acceso.`
- `why_it_is_critical`: `esta mezcla impide afirmar con precision cual es la regla efectiva de autorizacion. Ese tipo de ambigüedad es especialmente peligrosa en rutas admin y dificulta una auditoria de seguridad fuerte.`

### Finding

- `id`: `ARCH-P2-03`
- `severity`: `P2`
- `domain`: `payments`
- `title`: `La compra de contenido tiene al menos dos caminos de acreditacion con piezas distintas y sin una unica frontera transaccional visible`
- `files`:
  - `app/api/balance/checkout/route.ts:69`
  - `lib/server/repositories/payments.ts:76`
  - `lib/server/repositories/payments.ts:179`
  - `lib/mercadopago.ts:91`
  - `lib/server/repositories/ledger.ts:251`
- `routes`:
  - `app/api/balance/checkout/route.ts`
  - `app/api/mercadopago/finalize/route.ts`
  - `app/api/mercadopago/webhook/route.ts`
- `data_surfaces`:
  - `purchases`
  - `ledger_transactions`
  - `ledger_entries`
  - `notifications`
- `business_rule`: `una compra deberia tener un solo flujo canonico de acreditacion, ledger y notificacion`
- `evidence`: `el checkout interno usa `processInternalAlbumPurchase` y luego `recordInternalAlbumPurchase`; el finalize de Mercado Pago usa `creditApprovedAlbumPurchase`, que a su vez crea filas de compra, acredita ledger y notifica. Son rutas parecidas pero no unificadas.`
- `risk`: `si una pieza cambia y otra no, la regla de compra puede divergir entre saldo interno y pago externo. Tambien es dificil saber cual es la unidad atomica real de una compra.`
- `why_it_is_critical`: `el dominio de dinero ya esta repartido entre route, repositorio de pagos, repositorio de ledger y finalize externo. Esa dispersion es un predictor fuerte de inconsistencias silenciosas y merece auditoria prioritaria en stages 03 a 05.`

### Finding

- `id`: `ARCH-P2-04`
- `severity`: `P2`
- `domain`: `ledger`
- `title`: `El runtime financiero sigue cargando baseline legacy desde notificaciones, lo que mezcla migracion historica con operacion viva`
- `files`:
  - `lib/server/repositories/ledger.ts:122`
  - `lib/server/repositories/ledger.ts:148`
- `routes`:
  - todos los flujos que acreditan ingresos o leen balances
- `data_surfaces`:
  - `user_balances`
  - `ledger_entries`
  - `notifications`
- `business_rule`: `el balance canonico no deberia depender de parsing de mensajes legacy en operacion normal`
- `evidence`: `ensureLegacyCreatorBalanceBaseline` reconstruye balance inicial desde `loadCreatorEarnings` y desde notificaciones con `type = withdrawal_request`, parseando texto de mensajes para deducir retiros reservados.`
- `risk`: `la verdad del balance queda parcialmente derivada de estructuras no financieras. Cualquier cambio en mensajes o notificaciones puede contaminar la reconstruccion del estado financiero.`
- `why_it_is_critical`: `esta es una señal fuerte de acoplamiento historico entre capas incompatibles. Si sigue activa en runtime, afecta la confiabilidad del ledger y complica cualquier correccion posterior.`

## Cross-System Inconsistencies

- La identidad se bootstrappea en `auth.users` -> `users`/`profiles` por trigger en SQL, pero tambien se vuelve a completar desde `lib/server/auth/session.ts`. Hay dos lugares donde se intenta garantizar el mismo invariante.
- La autorizacion admin existe como roles persistidos y como fallback legacy en `isAdminUser`. No hay una sola fuente de verdad evidente.
- El dominio de compra cruza contenido, purchases, ledger, balances y notifications, pero sus caminos no estan expresados como un unico caso de uso central.
- El dominio financiero todavia contiene puentes legacy basados en mensajes/notificaciones, aun cuando ya existe un modelo ledger mas formal.

## Open Questions

- Si `app/api/mercadopago/webhook/route.ts` y `app/api/mercadopago/finalize/route.ts` comparten exactamente la misma idempotencia o si cada uno puede acreditar distintas partes del flujo.
- Si el rol `user` debe grantarse en cada request autenticado o si es solo una compensacion temporal por migracion.
- Si el sistema considera `purchases` como fuente de verdad de acceso y `ledger_transactions` como soporte financiero, o si ambos son igualmente canónicos.

## Stage Exit

La arquitectura real ya muestra tres zonas de prioridad maxima para la auditoria profunda:

- `auth/authz`: por mezcla de validacion con side effects y fuentes de verdad duales
- `payments/ledger`: por dispersion de la logica de compra y convivencia de mecanismos legacy
- `direct-chats premium`: porque agrega una tercera variante de monetizacion conectada a ledger y acceso

La etapa siguiente debe revisar manejo de estado cliente y fetching para verificar si esta complejidad server-side se replica en el frontend mediante cache incoherente, optimistic UI o flujos que aparentan exito sin confirmacion durable.
