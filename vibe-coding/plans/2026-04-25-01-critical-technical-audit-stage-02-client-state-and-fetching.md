# Audit Stage Report

## Metadata

- `plan_id`: `2026-04-25-01-critical-technical-audit`
- `stage_id`: `stage-02`
- `title`: `Estado cliente, fetching y sincronizacion con backend`
- `status`: `completed`
- `owner`: `vibe-agent`
- `date`: `2026-04-25`
- `domains_covered`: `viewer/session`, `profile`, `settings`, `sales`, `notifications`, `checkout-refresh`, `follow flows`

## Objective

Auditar si el estado cliente representa de forma confiable el estado persistido del sistema, y si las mutaciones o lecturas del frontend mantienen una sola fuente de verdad.

El foco de esta etapa fue detectar:

- caches duplicados o desalineados
- mutaciones hechas directamente desde cliente sobre tablas criticas
- sincronizacion basada en eventos manuales en vez de contratos de datos
- pantallas que calculan negocio desde estructuras legacy o parciales
- caminos donde la UI puede mostrar un estado consistente sin que exista una confirmacion durable fuerte

## Review Method

Se cruzo informacion entre:

- `lib/redux/api/*`
- `lib/redux/slices/*`
- `components/AppStateBootstrap.tsx`
- pantallas `settings`, `ventas`, `notificaciones`, `perfil`, `compras`

Se reviso:

- origen de cada lectura
- destino de cada mutacion
- invalidaciones RTK Query
- uso de `window.dispatchEvent`
- lecturas directas a Supabase desde componentes o APIs cliente
- coexistencia entre datos `notifications`, `user_meta`, RTK Query y slices

## Evidence Map

### Infraestructura de estado

- `components/AppStateBootstrap.tsx`
- `lib/redux/api/sessionApi.ts`
- `lib/redux/slices/viewerSlice.ts`

### Pantallas y APIs cliente auditadas

- `lib/redux/api/profileApi.ts`
- `lib/redux/api/settingsApi.ts`
- `lib/redux/api/commerceApi.ts`
- `lib/redux/api/notificationsApi.ts`
- `app/settings/page.tsx`
- `app/ventas/page.tsx`
- `app/notificaciones/page.tsx`
- `app/perfil/PerfilPageClient.tsx`
- `app/compras/page.tsx`

## Critical Findings

### Finding

- `id`: `STATE-P1-01`
- `severity`: `P1`
- `domain`: `viewer/session`
- `title`: `El estado del viewer existe duplicado entre RTK Query y un slice manual con la misma logica de hidratacion`
- `files`:
  - `lib/redux/api/sessionApi.ts:120`
  - `lib/redux/slices/viewerSlice.ts:103`
  - `components/AppStateBootstrap.tsx:106`
- `routes`:
  - superficies que consumen `useGetViewerQuery`
  - superficies que consumen `state.viewer`
- `data_surfaces`:
  - `/api/me`
  - `viewerSlice`
  - `sessionApi.getViewer`
- `business_rule`: `la sesion y el perfil efectivo del usuario deberian tener una sola fuente de verdad en cliente`
- `evidence`: `sessionApi.loadViewer` y `hydrateViewerState` repiten casi la misma transformacion de `/api/me`, mientras `AppStateBootstrap` ejecuta ambos caminos via `hydrateViewerState()` e invalidaciones de `sessionApi`.`
- `risk`: `el sistema puede mostrar distintos valores de `isAuthor`, balance, permisos o perfil dependiendo de si una pantalla lee del query cache o del slice.`
- `why_it_is_critical`: `viewer y permisos afectan acceso a creacion, admin, retiros y redirecciones. Duplicar ese estado con dos pipelines separadas eleva el riesgo de divergencia funcional, no solo de estilo.`

### Finding

- `id`: `STATE-P1-02`
- `severity`: `P1`
- `domain`: `client-sync`
- `title`: `La sincronizacion global depende de eventos manuales de window en lugar de contratos de invalidacion consistentes`
- `files`:
  - `components/AppStateBootstrap.tsx:12`
  - `components/AppStateBootstrap.tsx:121`
  - `app/perfil/PerfilPageClient.tsx:754`
  - `app/mensajes/page.tsx:1194`
  - `app/checkout/return/page.tsx:135`
  - `app/favoritos/page.tsx:74`
- `routes`:
  - `perfil`
  - `mensajes`
  - `checkout/return`
  - `favoritos`
  - cualquier pantalla dependiente de balance/compras/notificaciones
- `data_surfaces`:
  - eventos `balance-updated`
  - eventos `purchases-updated`
  - eventos `earnings-updated`
  - eventos `profile-updated`
- `business_rule`: `la consistencia de datos criticos no deberia depender de que cada pantalla recuerde emitir eventos globales`
- `evidence`: `AppStateBootstrap` escucha un conjunto fijo de eventos globales para rehidratar viewer y notificaciones. Varias pantallas emiten esos eventos manualmente despues de acciones locales.`
- `risk`: `si una mutacion olvida emitir el evento correcto, la UI puede quedar mostrando saldo, compras o permisos obsoletos aunque la DB ya haya cambiado, o al reves.`
- `why_it_is_critical`: `saldo, compras y permisos son datos de negocio. Usar un bus manual de browser como mecanismo principal de coherencia produce fallas silenciosas y muy dificiles de rastrear.`

### Finding

- `id`: `STATE-P1-03`
- `severity`: `P1`
- `domain`: `settings`
- `title`: `Settings mezcla user_meta y notifications como doble persistencia de metadata de perfil, payout y preferencias`
- `files`:
  - `lib/redux/api/settingsApi.ts:150`
  - `lib/redux/api/settingsApi.ts:174`
  - `lib/redux/api/settingsApi.ts:180`
  - `lib/redux/api/settingsApi.ts:290`
  - `lib/redux/api/settingsApi.ts:326`
  - `lib/redux/api/settingsApi.ts:365`
  - `lib/redux/api/settingsApi.ts:423`
- `routes`:
  - `app/settings/page.tsx`
- `data_surfaces`:
  - `user_meta`
  - `notifications`
  - `users`
  - `profiles`
- `business_rule`: `la metadata de configuracion deberia persistirse en una sola estructura canonica`
- `evidence`: `loadSettings` lee payout/profile/preferences tanto desde `user_meta` como desde `notifications`. Las mutaciones escriben en ambos lugares.`
- `risk`: `si una escritura falla en uno de los dos destinos o si otro flujo lee solo uno de ellos, la app puede cargar configuraciones distintas segun la pantalla o el momento.`
- `why_it_is_critical`: `payout profile y notification preferences no son decorativos; gobiernan retiros y comunicaciones del sistema. La doble persistencia sin una frontera transaccional clara es una fuente real de inconsistencia de negocio.`

### Finding

- `id`: `STATE-P1-04`
- `severity`: `P1`
- `domain`: `sales-withdrawals`
- `title`: `La pagina de ventas deriva negocio financiero desde consultas cliente directas y parsing de notificaciones`
- `files`:
  - `lib/redux/api/commerceApi.ts:375`
  - `lib/redux/api/commerceApi.ts:394`
  - `lib/redux/api/commerceApi.ts:507`
  - `app/ventas/page.tsx:84`
  - `app/ventas/page.tsx:93`
- `routes`:
  - `app/ventas/page.tsx`
- `data_surfaces`:
  - `posts`
  - `purchases`
  - `direct_messages`
  - `direct_message_purchases`
  - `notifications`
  - `withdrawals`
- `business_rule`: `los ingresos y retiros visibles al creador deberian salir de una agregacion server-side consistente, no de composicion parcial en cliente`
- `evidence`: `commerceApi.getSales` consulta directamente varias tablas desde el browser, arma ventas agrupadas, y reconstruye propinas desde `notifications.message`. Luego `VentasPage` vuelve a calcular reserva y disponibilidad con heuristicas locales.`
- `risk`: `la pantalla puede mostrar montos o disponibilidad inconsistentes con el backend real de retiros si cambia cualquiera de las piezas parciales o si la lectura RLS es incompleta.`
- `why_it_is_critical`: `es una superficie financiera sensible. La regla de cuanto se gano y cuanto se puede retirar no deberia depender de parsing cliente ni de agregaciones locales multi-tabla.`

### Finding

- `id`: `STATE-P2-05`
- `severity`: `P2`
- `domain`: `notifications-follow`
- `title`: `La pantalla de notificaciones ejecuta follow/unfollow directo contra Supabase y mantiene un estado paralelo al feed social`
- `files`:
  - `app/notificaciones/page.tsx:174`
  - `app/notificaciones/page.tsx:190`
  - `app/notificaciones/page.tsx:249`
- `routes`:
  - `app/notificaciones/page.tsx`
- `data_surfaces`:
  - `follows`
  - estado local `followingActorIds`
- `business_rule`: `seguir/dejar de seguir deberia tener un unico flujo cliente-servidor reutilizable`
- `evidence`: `NotificacionesPage` consulta `follows` directo con Supabase para pintar estado y luego inserta/borra filas directamente desde la pantalla, sin pasar por una API o mutation compartida.`
- `risk`: `la logica de follow queda distribuida entre notificaciones, perfil, explorar y otros componentes; cada uno puede manejar caches, notificaciones derivadas o errores de forma distinta.`
- `why_it_is_critical`: `aunque follow no es financiero, sí es una regla de negocio transversal y una fuente clara de inconsistencia estructural entre superficies del producto.`

## Cross-System Inconsistencies

- `viewer` se hidrata desde `/api/me` por dos caminos distintos: RTK Query y thunk/slice.
- `settings` usa `user_meta` como almacenamiento moderno, pero conserva `notifications` como almacenamiento espejo y también como fallback de lectura.
- `sales` y parte de `profile` consumen Supabase desde cliente para construir reglas de negocio que en otros dominios viven en endpoints server-side.
- la sincronizacion entre pantallas no se basa solo en invalidaciones RTK Query; depende además de `window.dispatchEvent`, `refetch()` manual y actualizaciones optimistas locales.

## Open Questions

- Si existe alguna pantalla adicional que lea payout/profile/preferences solo desde `notifications` y por eso se conservó el doble write.
- Si `getSales` usa lecturas cliente por una limitacion temporal de backend o si hoy se considera fuente canonica.
- Si hay una politica explícita sobre cuándo usar Supabase directo desde cliente y cuándo encapsular en `app/api/**`.

## Stage Exit

La `stage 02` confirma que la inconsistencia no está solo en backend: también existe en la capa cliente y afecta datos críticos.

Prioridades que quedan reforzadas:

- `settings`: por doble persistencia en `user_meta` y `notifications`
- `sales/withdrawals`: por cálculo financiero derivado desde cliente
- `viewer/session`: por fuentes de verdad duplicadas
- `cross-screen sync`: por dependencia de eventos globales manuales

La siguiente etapa debe auditar seguridad, autenticación y autorización de endpoints, porque varias de estas decisiones cliente solo son seguras si el backend es extremadamente estricto.
