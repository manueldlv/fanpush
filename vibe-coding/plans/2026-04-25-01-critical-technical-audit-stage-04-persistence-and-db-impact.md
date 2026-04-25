# Audit Stage Report

## Metadata

- `plan_id`: `2026-04-25-01-critical-technical-audit`
- `stage_id`: `stage-04`
- `title`: `Persistencia real e impacto en DB`
- `status`: `completed`
- `owner`: `vibe-agent`
- `date`: `2026-04-25`
- `domains_covered`: `posts`, `purchases`, `ledger`, `withdrawals`, `direct-chats`, `account archive`

## Objective

Detectar flujos que parecen exitosos desde la app pero pueden dejar persistencia parcial, huérfana o inconsistente.

## Review Method

Se siguió cada mutación crítica:

1. request
2. route handler
3. repositorio/helper
4. tablas/buckets impactados
5. lectura posterior esperada

Se buscó ausencia de transacción, writes en secuencia y storage huérfano.

## Evidence Map

- `app/api/posts/create/route.ts`
- `app/api/balance/checkout/route.ts`
- `lib/server/repositories/payments.ts`
- `lib/server/repositories/ledger.ts`
- `lib/server/repositories/withdrawals.ts`
- `app/api/direct-chats/threads/[id]/messages/route.ts`
- `lib/server/repositories/direct-chats.ts`
- `app/api/account/delete/route.ts`

## Critical Findings

### Finding

- `id`: `PERSIST-P1-01`
- `severity`: `P1`
- `domain`: `content-publish`
- `title`: `La creación de posts puede dejar álbumes y uploads huérfanos si falla después de insertar parcialmente`
- `files`:
  - `app/api/posts/create/route.ts:153`
  - `app/api/posts/create/route.ts:167`
  - `app/api/posts/create/route.ts:265`
- `routes`:
  - `POST /api/posts/create`
- `data_surfaces`:
  - `albums`
  - `posts`
  - `album_posts`
  - storage público/privado
- `business_rule`: `publicar contenido debería ser atómico desde la perspectiva del producto`
- `evidence`: `la ruta crea el álbum antes de subir archivos; luego sube storage; luego inserta posts; luego crea relaciones `album_posts`. Si falla cualquier etapa intermedia no hay rollback de álbum ni cleanup de archivos ya subidos.`
- `risk`: `pueden quedar álbumes vacíos, archivos subidos sin post asociado o posts sin linkage a álbum.`
- `why_it_is_critical`: `la publicación es un flujo central y monetizable; la persistencia parcial rompe listados, compras y moderación.`

### Finding

- `id`: `PERSIST-P1-02`
- `severity`: `P1`
- `domain`: `withdrawals`
- `title`: `La solicitud de retiro primero reserva ledger/balance y después escribe la notificación legacy, dejando ventana de estado parcial`
- `files`:
  - `app/api/withdrawals/request/route.ts:114`
  - `lib/server/repositories/withdrawals.ts:143`
  - `lib/server/repositories/ledger.ts:519`
- `routes`:
  - `POST /api/withdrawals/request`
- `data_surfaces`:
  - `ledger_transactions`
  - `ledger_entries`
  - `user_balances`
  - `withdrawal_requests`
  - `notifications`
- `business_rule`: `un retiro debería quedar íntegramente registrado o no registrado`
- `evidence`: `createWithdrawalRequest` llama `reserveWithdrawalLedgerBalance`, que ya crea ledger, entries, balance delta y `withdrawal_requests`, y recién después inserta la `notification` legacy.`
- `risk`: `si falla la inserción en `notifications`, el balance queda reservado y la tabla `withdrawal_requests` existe, pero el flujo que aún depende de notificaciones puede quedar incompleto.`
- `why_it_is_critical`: `afecta dinero bloqueado y lectura posterior de retiros en varias pantallas.`

### Finding

- `id`: `PERSIST-P1-03`
- `severity`: `P1`
- `domain`: `direct-chats`
- `title`: `El envío de adjuntos y premium sube archivos antes de confirmar la inserción del mensaje`
- `files`:
  - `app/api/direct-chats/threads/[id]/messages/route.ts:79`
  - `app/api/direct-chats/threads/[id]/messages/route.ts:167`
  - `lib/server/repositories/direct-chats.ts:786`
- `routes`:
  - `POST /api/direct-chats/threads/[id]/messages`
- `data_surfaces`:
  - storage público
  - storage premium
  - `direct_messages`
  - `direct_threads`
- `business_rule`: `un adjunto debería existir sólo si el mensaje que lo referencia quedó persistido`
- `evidence`: `la ruta sube previews y archivos premium/públicos al storage y luego recién llama `sendDirectMediaMessage`. Si falla la inserción del mensaje o el update del thread, no hay cleanup de objetos.`
- `risk`: `objetos huérfanos en buckets, costos de storage y media inaccesible o no trazable.`
- `why_it_is_critical`: `chat premium es un flujo de monetización; storage huérfano degrada integridad y dificulta trazabilidad de compra/entrega.`

### Finding

- `id`: `PERSIST-P1-04`
- `severity`: `P1`
- `domain`: `payments`
- `title`: `Las compras externas e internas reparten la persistencia entre RPC, purchases, ledger y notifications sin una transacción única visible`
- `files`:
  - `app/api/balance/checkout/route.ts:85`
  - `lib/server/repositories/payments.ts:76`
  - `lib/server/repositories/payments.ts:179`
  - `lib/mercadopago.ts:143`
  - `lib/server/repositories/ledger.ts:478`
- `routes`:
  - `POST /api/balance/checkout`
  - `POST /api/mercadopago/finalize`
  - `POST /api/mercadopago/webhook`
- `data_surfaces`:
  - RPCs internas
  - `purchases`
  - `ledger_transactions`
  - `ledger_entries`
  - `notifications`
- `business_rule`: `comprar debería producir un único resultado durable y consistente`
- `evidence`: `la compra interna delega parte al RPC y parte a `recordInternalAlbumPurchase`; la compra externa usa `creditApprovedAlbumPurchase`, que además dispara ledger y notificación. No se observa una única unidad atómica entre todos esos pasos.`
- `risk`: `pueden existir casos de ledger acreditado con compra incompleta, o compra visible con side-effects parciales según el punto de falla.`
- `why_it_is_critical`: `es dinero más acceso a contenido. La persistencia parcial en este dominio es P1 aunque no esté probada en producción.`

## Cross-System Inconsistencies

- publicaciones: DB y storage no comparten una transacción lógica visible;
- retiros: tabla nueva y notificación legacy se escriben en tiempos distintos;
- chat premium: storage y mensaje se persisten en capas separadas;
- compras: los caminos interno y externo no comparten una frontera única de commit.

## Open Questions

- Si las RPC SQL de compra interna encapsulan también escrituras en `purchases`; desde TypeScript no se ve esa parte.
- Si existe limpieza asíncrona de objetos huérfanos en storage.

## Stage Exit

La integridad transaccional del producto es más débil en tres flujos:

- publicación de contenido
- retiros
- compras/entregas premium

La etapa siguiente consolida las reglas de negocio ambiguas que hacen que estas persistencias se interpreten distinto según la capa.
