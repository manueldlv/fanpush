# Plan

- id: 2026-04-25-04-direct-chat-realtime-and-presence-plan
- title: Plan tecnico para llevar chat directo a realtime con Supabase y microinteracciones de presencia
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- based_on:
  - vibe-coding/plans/2026-04-02-01-messaging-system.md
  - vibe-coding/plans/2026-04-25-03-phase-09-content-and-chat-persistence-detailed.md
- files_allowed:
  - app/**
  - components/**
  - lib/**
  - services/**
  - supabase/**
  - vibe-coding/**
- files_blocked:
  - No romper endpoints existentes de chat directo
  - No eliminar el camino actual basado en API hasta validar el canal realtime en produccion
  - No exponer presencia o metadata efimera sin control de membresia del thread
  - No introducir audio real como feature final hasta cerrar storage, permisos y estados efimeros

## Goal

Diseñar una migracion segura del chat directo actual hacia una experiencia realtime soportada por Supabase, manteniendo compatibilidad con los flujos actuales de mensajes, adjuntos y premium, y agregando microinteracciones de presencia y composicion que hagan visible la actividad del otro lado.

El objetivo no es solo "recibir mensajes al instante", sino cerrar el gap completo de interaccion:

- mensajes nuevos en tiempo real
- lista de chats y badges sincronizados sin depender de `window.focus`
- estados de lectura consistentes
- presencia por thread
- indicadores efimeros tipo:
  - `X esta escribiendo`
  - `X esta grabando audio`
  - `X esta preparando una foto`
  - `X esta por enviar contenido`

## Current Baseline

El sistema actual ya tiene una base persistente correcta para soportar realtime:

- `direct_threads`
- `direct_thread_members`
- `direct_messages`
- `direct_message_purchases`
- `direct_user_blocks`

El cliente actual:

- carga hilos con `GET /api/direct-chats`
- carga detalle con `GET /api/direct-chats/threads/[id]`
- envia mensajes con `POST /api/direct-chats/threads/[id]/messages`
- actualiza UI con la respuesta de la API
- refresca badges secundarios solo en montaje, `focus` o eventos manuales

No existe hoy:

- `supabase.channel(...)`
- `postgres_changes`
- `broadcast`
- polling continuo
- websocket custom
- presencia efimera por thread

## Product Decision

La estrategia recomendada es:

1. Mantener la API actual como camino canónico de escritura.
2. Agregar Supabase Realtime como mecanismo de sincronización cliente-cliente.
3. Separar claramente:
   - eventos persistentes
   - eventos efimeros de presencia y composicion
4. No reemplazar el backend del chat por escrituras directas desde cliente.

Razon:

- la escritura actual ya encapsula reglas de negocio, permisos, uploads y respuesta normalizada
- los adjuntos premium dependen de signed URLs y logica server-side
- el cliente no deberia asumir reglas criticas del chat

## Architecture Target

### 1. Write Path

Se mantiene sin cambios conceptuales:

- cliente envia a API interna
- API valida authz
- API persiste en Supabase
- API devuelve thread actualizado

### 2. Persistent Realtime Path

Se agrega una capa de suscripcion cliente a Supabase Realtime para escuchar cambios persistidos:

- `direct_messages`
- `direct_threads`
- `direct_thread_members`
- opcionalmente `direct_message_purchases`

Regla principal:

- Realtime no reemplaza la escritura
- Realtime gatilla reconciliacion y refresh fino de estado

### 3. Ephemeral Presence Path

Se agrega un canal efimero por thread para eventos de presencia y composicion.

Esta capa no debe persistirse en tablas de negocio principales.

Estados objetivo:

- idle
- viewing_thread
- typing
- recording_audio
- preparing_image
- preparing_video
- preparing_pack
- uploading

## Recommended Supabase Features

### Realtime para datos persistentes

Usar `postgres_changes` de Supabase sobre tablas del chat.

Objetivo:

- detectar inserts de mensajes
- detectar cambios en `last_message_at`, `last_message_preview`, `last_sender_id`
- detectar cambios de `force_unread`, `pinned`, `hidden`, `last_read_at`
- detectar compras de mensajes premium que cambian el estado visible del contenido

### Broadcast o Presence para estado efimero

Usar canal realtime por thread para microinteracciones no persistentes.

Hay dos opciones validas:

1. `broadcast`
   - simple para eventos como `typing_start`, `typing_stop`, `recording_start`
   - buena opcion si el estado efimero se modela como eventos de corta vida

2. `presence`
   - mejor si se quiere reflejar estado actual agregado por usuario
   - util para reconstruir UI al reconectar

Recomendacion:

- usar `presence` para estado actual resumido
- usar `broadcast` solo si hace falta granularidad extra de eventos de transicion

Si se busca simplicidad operativa inicial:

- arrancar con `presence` solamente

## Business Rules To Preserve

Estas reglas deben mantenerse durante toda la migracion:

1. La API actual sigue siendo la unica via de escritura persistente.
2. Los mensajes premium siguen resolviendo acceso real desde compra persistida, no desde estado cliente.
3. Las signed URLs de contenido premium no deben circular como verdad durable en eventos realtime.
4. El estado `unread` sigue derivando de:
   - `force_unread`
   - `last_read_at`
   - `last_message_at`
   - `last_sender_id`
5. Bloqueos de usuario deben seguir impidiendo interacciones visibles y operativas.
6. Borrado de mensajes debe seguir respetando autoría y restricciones actuales.
7. Abrir un chat sigue marcandolo como leido por el camino server-side vigente.
8. Ninguna microinteraccion efimera debe tener efectos de negocio.
9. Si realtime falla, el chat debe seguir funcionando con la capa API actual.

## Non-Negotiable Safety Rules

- No cambiar contratos de endpoints existentes.
- No exigir realtime para que el chat siga siendo usable.
- No mezclar presencia efimera con fuente canónica de negocio.
- No depender del payload realtime para URLs premium finales.
- No permitir suscripciones a threads donde el usuario no es miembro.
- No exponer presencia de usuarios bloqueados en chats bloqueados u ocultos.

## Data Model Recommendations

### Opcion A: Sin nuevas tablas para efimeros

Usar solo canales realtime efimeros por thread.

Ventajas:

- menor costo de persistencia
- no contamina tablas de negocio
- mejor encaje para `typing`, `recording`, `uploading`

Desventajas:

- menor trazabilidad historica
- necesita buena estrategia de TTL y limpieza

### Opcion B: Tabla liviana de presencia por thread

Crear una tabla tipo `direct_thread_presence` o `direct_thread_ephemeral_state`.

No es la recomendacion inicial.

Solo conviene si se necesita:

- auditoria
- debugging fuerte de presencia
- analitica
- rehidratacion server-driven de estados efimeros

Recomendacion final:

- no crear tabla nueva para efimeros en fase inicial
- usar canales efimeros
- evaluar persistencia solo si aparecen problemas de debugging o soporte

## Realtime Subscription Design

### Surface 1: Current Open Thread

Cuando el usuario abre un thread:

- suscribirse a cambios persistentes del thread actual
- suscribirse al canal efimero de presencia del thread actual
- reconciliar mensajes nuevos en vivo
- reconciliar compras premium o borrados del thread

Comportamiento esperado:

- si entra mensaje nuevo del otro participante, aparece sin recargar
- si el usuario compra un premium desde otra superficie relevante, el estado visible se actualiza
- si se borra un mensaje propio, desaparece sin reload

### Surface 2: Thread List

La lista lateral debe suscribirse a cambios que afecten:

- orden de chats
- preview ultimo mensaje
- badge unread
- pinned
- hidden

Comportamiento esperado:

- un mensaje nuevo sube el thread arriba
- el preview cambia
- el badge unread se prende o apaga correctamente
- no hace falta esperar `focus`

### Surface 3: Global Badges

`SidebarLeft` y `FloatingMessagesButton` deben dejar de depender de `focus` como fuente principal.

Comportamiento esperado:

- el contador de mensajes cambia apenas entra un mensaje
- el indicador flotante se actualiza aunque el usuario siga en otra vista

## Reconciliation Strategy

Para no sobrecargar el cliente con demasiada logica fina, usar un modelo hibrido:

1. Intentar aplicar update local cuando el evento sea trivial.
2. Re-fetch del thread o de la lista cuando el evento sea sensible.

Aplicar localmente:

- insert de mensaje simple conocido
- cambio de typing/presence
- reorder visual de thread list

Forzar re-fetch:

- premium purchase
- delete message
- cambios de signed URLs
- dudas de orden o desincronizacion
- reconnect despues de desconexion

Regla:

- favorecer consistencia antes que optimizacion agresiva

## Presence and Microinteraction Model

### Presence State Contract

Cada participante del thread puede exponer un estado efimero resumido:

- `state`: `idle | viewing | typing | recording_audio | preparing_image | preparing_video | preparing_pack | uploading`
- `updated_at`
- `thread_id`
- `user_id`
- metadata opcional:
  - `attachment_count`
  - `media_kind`
  - `progress_hint`

### UX Rules

1. Solo mostrar microestado del otro participante.
2. Nunca mostrar dos estados simultaneos contradictorios.
3. Prioridad visual sugerida:
   - `uploading`
   - `recording_audio`
   - `preparing_image|video|pack`
   - `typing`
   - `viewing`
4. Auto-expirar estados efimeros si no se renuevan.
5. No dejar ghost states tras cerrar la pantalla o perder conexion.

### Suggested TTLs

- `typing`: 3 a 5 segundos sin actividad
- `recording_audio`: hasta evento stop o timeout de 30 segundos
- `preparing_image|video|pack`: 10 a 20 segundos
- `uploading`: mientras exista operacion activa local, con cleanup al finalizar o fallar
- `viewing`: heartbeat liviano mientras el thread esta abierto

## UI Microinteractions Plan

### 1. Typing Indicator

UI objetivo:

- texto discreto debajo del header o encima del composer
- animacion de tres puntos viva pero sutil
- copy:
  - `Matias esta escribiendo...`

Reglas:

- emitir `typing` solo cuando hay input no vacio y el usuario efectivamente interactua
- debounce para no emitir en cada tecla
- detener al enviar, borrar todo el draft, perder foco prolongado o cerrar thread

### 2. Recording Audio Indicator

Aunque audio real no exista aun, se puede preparar la interaccion futura:

- `Matias esta grabando audio...`
- orb pulsante rojo tenue
- duracion opcional local para quien graba

Reglas:

- no publicar archivo ni metadata de audio hasta feature real
- si el flujo de audio no se implementa en la misma fase, dejarlo como contrato efimero opcional y UI apagada por flag

### 3. Preparing Photo / Video / Pack

Objetivo:

- mostrar que la otra persona esta preparando envio de media antes del upload definitivo

Copies sugeridos:

- `Matias esta preparando una foto`
- `Matias esta preparando un video`
- `Matias esta preparando un pack`

Microinteracciones:

- icono mini de foto/video/pack
- shimmer suave o badge de "preparando"
- si hay `attachment_count`, mostrar:
  - `Matias esta preparando 3 archivos`

### 4. Uploading State

Objetivo:

- comunicar que el usuario ya paso de composicion a envio

Copies sugeridos:

- `Matias esta subiendo una foto`
- `Matias esta subiendo contenido`

Notas:

- no prometer entrega hasta que la API confirme
- el estado debe desaparecer si el upload falla

### 5. Seen / Viewing Thread

Objetivo:

- señal minima de presencia sin invadir privacidad

Opciones:

- `En el chat`
- `Viendo la conversacion`

Regla:

- mostrar solo si ambos son miembros validos y no hay bloqueo
- no mostrar "online global", solo presencia contextual del thread

## UX Composition Rules

- Los estados efimeros deben ubicarse en un solo punto consistente de la UI.
- No mezclar badge de presence con mensajes del sistema persistentes.
- No convertir cada evento efimero en toast.
- En mobile, priorizar una sola linea contextual bajo el header.
- En desktop, puede existir una linea contextual bajo nombre/avatar.
- La animacion debe ser sobria, no invasiva, y no competir con el contenido del chat.

## Suggested Execution Phases

## Phase 00

### Goal

Preparar la base tecnica y de observabilidad sin cambiar comportamiento visible.

### Tasks

- Inventariar consumidores del chat actual
- Definir wrapper cliente para canales Supabase
- Definir contrato de eventos efimeros
- Definir estrategia de cleanup y reconexion
- Instrumentar logs de suscripcion y resync

### Acceptance

- existe contrato tecnico documentado para realtime
- existe decision cerrada entre `presence` vs `broadcast`
- existe estrategia de fallback si realtime no conecta

## Phase 01

### Goal

Agregar realtime persistente para el thread abierto.

### Tasks

- Suscribir el thread abierto a mensajes persistentes
- Hacer append o refetch controlado al entrar mensaje
- Reconciliar delete y premium purchase
- Forzar cleanup de subscription al cambiar de thread

### Acceptance

- los mensajes entran sin refresh manual
- no quedan subscriptions colgadas al navegar
- los premium siguen respetando signed URLs server-side

## Phase 02

### Goal

Sincronizar lista de chats y badges globales.

### Tasks

- Suscribir cambios sobre threads y members
- Actualizar preview, orden y unread en vivo
- Remover dependencia principal de `window.focus`
- Reconciliar sidebar y floating button

### Acceptance

- lista y badges reaccionan al instante
- el orden de chats se mantiene coherente
- el fallback por `focus` queda solo como red de seguridad

## Phase 03

### Goal

Agregar presencia efimera y typing.

### Tasks

- Montar canal efimero por thread
- Emitir `viewing`
- Emitir y limpiar `typing`
- Resolver prioridad de estados remotos
- Diseñar componente de indicador contextual

### Acceptance

- el otro usuario puede ver `esta escribiendo`
- los estados se limpian al desconectar o cambiar de thread
- no hay ghost typing persistente

## Phase 04

### Goal

Agregar microinteracciones de media y preparar contrato de audio.

### Tasks

- Emitir `preparing_image|video|pack`
- Emitir `uploading`
- Integrar con composer de adjuntos
- Definir feature flag o estado dormido para audio
- Diseñar copy y motion states

### Acceptance

- la preparacion de media se ve antes del envio
- el estado de subida refleja progreso de intencion aunque no muestre porcentaje exacto
- audio queda tecnicamente preparado aunque no se lance si no se aprueba

## Phase 05

### Goal

Hardening, fallbacks y rollout seguro.

### Tasks

- Reconnect con resync
- deduplicacion de eventos
- fallback a refetch si se pierde consistencia
- test manual multi-cliente
- checklist de rollout y monitoreo

### Acceptance

- el chat sigue usable con realtime degradado
- no hay duplicados evidentes
- la reconexion no deja estados falsos

## Files Expected To Change In Execution

Probables superficies:

- `app/mensajes/page.tsx`
- `components/SidebarLeft.tsx`
- `components/FloatingMessagesButton.tsx`
- nuevos hooks o helpers en `lib/`
- posible capa `lib/chat-realtime.ts` o similar
- posible capa `lib/chat-presence.ts` o similar
- `lib/supabase.ts` o wrapper especializado para canales
- posible migracion `supabase/migrations/**` solo si se aprueba una necesidad estructural extra

## Install / Dependency Guidance

### Recommended Default

No instalar un servicio externo nuevo.

Usar lo ya disponible con Supabase:

- `@supabase/supabase-js`
- Supabase Realtime del proyecto actual

### Optional Checks Before Execution

- confirmar que Realtime esta habilitado para el proyecto Supabase
- confirmar tablas publicadas o accesibles para realtime segun configuracion del proyecto
- confirmar limites de canales concurrentes esperados

### Do Not Add Unless Proven Necessary

- `socket.io`
- Pusher
- Ably
- servicio websocket custom

Razon:

- aumentan complejidad operativa
- duplican infraestructura
- no resuelven mejor el caso actual dado el stack existente

## Open Technical Decisions

1. Si usar `presence` puro o `presence + broadcast`.
   Recomendacion:
   - empezar con `presence` puro

2. Si escuchar eventos amplios o por thread puntual.
   Recomendacion:
   - thread abierto: granular
   - lista/badges: una suscripcion compacta global del usuario

3. Si agregar tabla estructural nueva.
   Recomendacion:
   - no en la primera fase salvo bloqueo tecnico real

4. Si audio entra en el mismo release.
   Recomendacion:
   - no necesariamente
   - dejar contrato efimero listo y feature flag

## Validation Plan

Cada fase debe probarse al menos con:

- dos sesiones de usuario reales
- desktop + mobile cuando aplique
- envio de texto
- envio de adjunto
- envio premium
- compra premium
- bloqueo de usuario
- delete de mensaje
- cambio rapido entre threads
- refresh del navegador con thread abierto
- corte y reconexion de red

## Rollout Strategy

1. Activar primero realtime persistente en thread abierto.
2. Activar luego lista y badges.
3. Activar despues presence y typing.
4. Activar por ultimo media microinteractions.

Recomendacion:

- usar flags de rollout por capability
- poder apagar presence sin apagar mensajes realtime

## Success Criteria

- El chat recibe mensajes nuevos sin refresh manual.
- La lista de chats se reordena y actualiza preview en vivo.
- Los badges de mensajes no dependen de `focus`.
- Los indicadores efimeros se sienten fluidos y no dejan estados fantasmas.
- El flujo premium sigue seguro y consistente.
- El sistema degrada con elegancia si realtime falla.

## Execution Notes For Future Implementation

- Mantener la escritura server-side.
- Usar realtime como sincronizacion y presencia, no como verdad de negocio.
- Preferir consistencia observable sobre optimizacion agresiva.
- Si una fase exige tocar estructura DB o reglas de authz, registrar aprobacion explicita antes de ejecutar.
