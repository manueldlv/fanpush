# Plan

- id: 2026-04-25-03-full-project-execution-roadmap
- title: Roadmap completo de ejecucion por etapas para remediar hallazgos criticos del proyecto
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- based_on:
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-06-critical-findings-summary.md
  - vibe-coding/plans/2026-04-25-02-critical-remediation-execution-plan.md
- files_allowed:
  - app/**
  - components/**
  - lib/**
  - services/**
  - supabase/**
  - scripts/**
  - vibe-coding/**
- files_blocked:
  - No ejecutar fases fuera de orden sin documentar dependencia resuelta
  - No retirar compatibilidad legacy sin marcar consumers migrados
  - No cambiar contratos públicos sin estrategia de compatibilidad

## Goal

Definir el plan operativo completo de ejecución del proyecto por etapas, con un índice persistente que permita:

- saber exactamente qué fase sigue
- marcar qué ya se hizo
- retomar el trabajo si la sesión se corta
- evitar que cambios críticos se ejecuten fuera de secuencia

## How To Use This Roadmap

Este archivo es el índice maestro de ejecución.

Reglas de uso:

1. Antes de empezar una fase:
   - marcar su estado en `Execution Index`
   - completar `Last Resume Point`

2. Durante una fase:
   - trabajar solo dentro del alcance de esa fase
   - registrar blockers o decisiones nuevas en `Execution Log`

3. Al terminar una fase:
   - marcar checklist de salida
   - actualizar `Execution Index`
   - crear o actualizar la ejecución correspondiente en `vibe-coding/executions/`
   - dejar el próximo punto de reanudación

4. Si la sesión se corta:
   - volver a este archivo
   - leer `Current Phase`
   - leer `Last Resume Point`
   - continuar desde el último subtask no marcado

## Detailed Phase Documents

Cada fase tiene su documento detallado. El roadmap maestro no reemplaza esos documentos; los indexa.

| Phase | Detailed Plan |
| --- | --- |
| 00 | `vibe-coding/plans/2026-04-25-03-phase-00-operational-setup-detailed.md` |
| 01 | `vibe-coding/plans/2026-04-25-03-phase-01-payments-and-api-security-detailed.md` |
| 02 | `vibe-coding/plans/2026-04-25-03-phase-02-admin-db-roles-detailed.md` |
| 03 | `vibe-coding/plans/2026-04-25-03-phase-03-payouts-meta-detailed.md` |
| 04 | `vibe-coding/plans/2026-04-25-03-phase-04-withdrawals-and-ledger-detailed.md` |
| 05 | `vibe-coding/plans/2026-04-25-03-phase-05-earnings-and-tips-detailed.md` |
| 06 | `vibe-coding/plans/2026-04-25-03-phase-06-purchases-core-detailed.md` |
| 07 | `vibe-coding/plans/2026-04-25-03-phase-07-viewer-session-state-detailed.md` |
| 08 | `vibe-coding/plans/2026-04-25-03-phase-08-sales-and-withdrawals-server-driven-detailed.md` |
| 09 | `vibe-coding/plans/2026-04-25-03-phase-09-content-and-chat-persistence-detailed.md` |
| 10 | `vibe-coding/plans/2026-04-25-03-phase-10-account-archive-detailed.md` |
| 11 | `vibe-coding/plans/2026-04-25-03-phase-11-legacy-cleanup-detailed.md` |

## Cross-Phase Rules

Aplican a todas las fases:

1. No cerrar una ambigüedad crítica por intuición.
2. Documentar toda duda en el documento detallado de la fase.
3. Resumir blockers también en `Execution Log`.
4. No retirar compatibilidad temporal sin inventario de consumers migrados.
5. Si una fase cambia una regla de negocio, detenerse y validar con Matias.
6. Si la regla no cambia pero el naming o la semántica están confusos, documentar y seguir.

## Ambiguity Register Protocol

Toda fase debe tener o abrir estas secciones en su execution doc:

- `Ambiguity Register`
- `Open Questions`
- `Decision Log`
- `Last Safe Resume Point`

Formato mínimo de una ambigüedad:

- `id`
- `topic`
- `files_or_tables`
- `why_it_is_ambiguous`
- `possible_safe_assumption`
- `blocks_phase`: `yes/no`
- `status`

## Validation Protocol

Toda fase debe cerrar con evidencia de estas verificaciones cuando apliquen:

- persistencia real en DB
- auth/authz coherente
- invalidación/cache coherente
- compatibilidad temporal documentada
- lectura server/client alineada
- ausencia de parsing frágil para lógica crítica

## Execution Index

Estado permitido por etapa:

- `pending`
- `ready`
- `in_progress`
- `blocked`
- `done`

| Phase | Status | Execution Doc | Depends On | Goal |
| --- | --- | --- | --- | --- |
| 00 | `ready` | `pending` | none | Preparar guardrails, validación y trazabilidad |
| 01 | `pending` | `pending` | 00 | Cerrar P0 de webhook y endurecer límites API |
| 02 | `pending` | `pending` | 01 | Dejar admin solo sobre roles persistidos |
| 03 | `pending` | `pending` | 02 | Canonicalizar payout data en `payouts_meta` |
| 04 | `pending` | `pending` | 03 | Rehacer retiros sobre workflow + reserva + payout real |
| 05 | `pending` | `pending` | 04 | Sacar earnings/tips de texto libre y llevarlos a fuente estructurada |
| 06 | `pending` | `pending` | 05 | Unificar compras internas y externas en un core canónico |
| 07 | `pending` | `pending` | 06 | Unificar viewer/session y contratos de estado cliente |
| 08 | `pending` | `pending` | 07 | Mover ventas/retiros a lectura server-driven consistente |
| 09 | `pending` | `pending` | 08 | Reparar integridad de publicación de contenido y chat uploads |
| 10 | `pending` | `pending` | 09 | Rehacer archivado de cuenta con secuencia segura |
| 11 | `pending` | `pending` | 10 | Limpiar legado: notifications/user_meta fallbacks y commission normalization dispersa |

## Current Phase

- `current_phase`: `00`
- `current_status`: `ready`
- `last_updated`: `2026-04-25`

## Last Resume Point

- `phase`: `00`
- `subtask`: `00.1`
- `note`: `Empezar creando documentos de ejecución por fase y checklist de validación transversal antes de tocar código de producto.`

## Global Completion Checklist

- [ ] Existe ejecución por fase en `vibe-coding/executions/`
- [ ] Cada fase tiene validación asociada
- [ ] Cada fase tiene documento detallado enlazado
- [ ] Cada fase tiene lugar explícito para ambiguidades y preguntas
- [ ] Ningún fallback legacy fue eliminado sin migrar consumers
- [ ] Los cambios de dinero son idempotentes y rastreables
- [ ] Los cambios de authz no dependen de env fallback
- [ ] Las lecturas críticas no dependen de parsing de `notifications.message`
- [ ] El cliente ya no depende de eventos globales manuales para coherencia crítica

## Execution Log

- `2026-04-25`: el roadmap fue expandido con documentos detallados por fase para incluir alcance exacto, fuentes de reglas, protocolo de ambigüedad y reanudación segura.

## Phase 00

### Title

Preparación operativa y guardrails de ejecución

### Goal

Preparar la ejecución para no perder contexto ni romper secuencia.

### Subtasks

- [ ] `00.1` Crear documento de ejecución `vibe-coding/executions/2026-04-25-03-phase-00-setup.md`
- [ ] `00.2` Definir checklist estándar de validación por fase
- [ ] `00.3` Definir convención para marcar consumers legacy migrados
- [ ] `00.4` Confirmar orden de despliegue seguro entre backend, DB y cliente

### Exit Criteria

- [ ] Existe execution doc de fase
- [ ] Quedó definida la plantilla de progreso para fases siguientes
- [ ] El roadmap fue actualizado con estado `done`

## Phase 01

### Title

Seguridad inmediata de pagos y límites API

### Goal

Corregir primero la superficie `P0/P1` de seguridad sin cambiar el negocio.

### Scope

- `app/api/mercadopago/webhook/route.ts`
- `lib/mercadopago.ts`
- `app/api/media/access/route.ts`
- validaciones auxiliares relacionadas

### Subtasks

- [ ] `01.1` Autenticar webhook de Mercado Pago
- [ ] `01.2` Validar tipo de evento y payload mínimo
- [ ] `01.3` Agregar trazabilidad e idempotencia observable
- [ ] `01.4` Restringir `media/access` a recursos válidos por contexto
- [ ] `01.5` Revisar respuestas de error para no filtrar información sensible

### Exit Criteria

- [ ] El webhook no procesa requests no autenticados
- [ ] `media/access` no funciona como enumerador arbitrario
- [ ] Validaciones corridas y registradas

## Phase 02

### Title

Admin solo por roles persistidos

### Goal

Eliminar la ambigüedad de autorización admin.

### Scope

- `lib/admin.ts`
- `lib/server/auth/roles.ts`
- `lib/server/auth/authorization.ts`
- `app/api/admin/**`
- `/api/me`

### Subtasks

- [ ] `02.1` Introducir resolución canónica de admin desde DB
- [ ] `02.2` Mantener transición controlada si hace falta
- [ ] `02.3` Migrar consumers a la nueva resolución
- [ ] `02.4` Retirar fallback por `ADMIN_EMAILS` / `ADMIN_USERNAMES`
- [ ] `02.5` Verificar rutas admin y `/api/me`

### Exit Criteria

- [ ] Ser admin depende solo de roles persistidos
- [ ] No quedan decisiones de admin por env fallback

## Phase 03

### Title

Fuente canónica de datos de cobro en `payouts_meta`

### Goal

Sacar payout data del legado y centralizarlo en una estructura operativa explícita.

### Scope

- migración para `payouts_meta`
- `lib/payouts.ts`
- `app/api/me/route.ts`
- `app/api/withdrawals/request/route.ts`
- `lib/redux/api/settingsApi.ts`

### Subtasks

- [ ] `03.1` Crear estructura `payouts_meta`
- [ ] `03.2` Definir contrato `accounts.default`
- [ ] `03.3` Hacer dual-read temporal
- [ ] `03.4` Mover escrituras a `payouts_meta`
- [ ] `03.5` Marcar `notifications` como compatibilidad temporal de solo lectura

### Exit Criteria

- [ ] Settings, `/api/me` y retiros leen la misma fuente canónica
- [ ] Las escrituras nuevas ya no dependen de `notifications`

## Phase 04

### Title

Rehacer retiros sobre workflow canónico + reserva de usuario + payout real

### Goal

Separar claramente:

- request operativo
- reserva del saldo del usuario
- pago real al exterior

### Scope

- `withdrawal_requests`
- ledger de retiros
- admin de retiros
- ventas/retiros

### Subtasks

- [ ] `04.1` Documentar máquina de estados única de retiros en código
- [ ] `04.2` Alinear `withdrawal_requests` con esa máquina
- [ ] `04.3` Renombrar o documentar `payout_request` como reserva interna si sigue existiendo
- [ ] `04.4` Separar explícitamente payout real de reserva interna
- [ ] `04.5` Mantener compatibilidad temporal con legacy notifications
- [ ] `04.6` Validar cancelación/rechazo/pago real

### Exit Criteria

- [ ] La semántica de retiros es única y legible
- [ ] Reserva del usuario y payout real no se confunden
- [ ] Las pantallas consumen una interpretación coherente

## Phase 05

### Title

Earnings, tips y reporting financiero estructurado

### Goal

Eliminar parsing de texto libre como fuente de dinero.

### Scope

- `lib/earnings.ts`
- `lib/server/repositories/ledger.ts`
- `app/api/purchases/route.ts`
- superficies de ventas/earnings

### Subtasks

- [ ] `05.1` Definir fuente estructurada canónica para tips
- [ ] `05.2` Recalcular earnings desde datos estructurados
- [ ] `05.3` Mantener compatibilidad de lectura mientras existan datos legacy
- [ ] `05.4` Ajustar consumers de reporting

### Exit Criteria

- [ ] Earnings y tips no dependen de `notifications.message`
- [ ] Reporting usa datos estructurados

## Phase 06

### Title

Core canónico de compras

### Goal

Unificar compras internas y externas en una misma semántica de persistencia.

### Scope

- `app/api/balance/checkout/route.ts`
- `app/api/mercadopago/finalize/route.ts`
- `app/api/mercadopago/webhook/route.ts`
- `lib/server/repositories/payments.ts`
- `lib/server/repositories/ledger.ts`

### Subtasks

- [ ] `06.1` Diseñar caso de uso canónico de acreditación de compra
- [ ] `06.2` Hacer converger checkout interno
- [ ] `06.3` Hacer converger finalize/webhook externo
- [ ] `06.4` Verificar idempotencia end-to-end
- [ ] `06.5` Verificar notificaciones y acceso a contenido

### Exit Criteria

- [ ] Compras internas y externas dejan el mismo resultado durable
- [ ] No hay doble interpretación de compra según canal

## Phase 07

### Title

Fuente de verdad única para viewer/session

### Goal

Eliminar duplicación entre `viewerSlice` y `sessionApi`.

### Scope

- `components/AppStateBootstrap.tsx`
- `lib/redux/api/sessionApi.ts`
- `lib/redux/slices/viewerSlice.ts`
- consumers de viewer

### Subtasks

- [ ] `07.1` Elegir fuente canónica en cliente
- [ ] `07.2` Migrar consumers progresivamente
- [ ] `07.3` Reducir duplicación de hidratación
- [ ] `07.4` Mantener compatibilidad mientras existan readers antiguos

### Exit Criteria

- [ ] Viewer no se calcula por dos pipelines diferentes
- [ ] Las pantallas críticas consumen la misma verdad

## Phase 08

### Title

Ventas y retiros server-driven

### Goal

Sacar lógica financiera crítica del cliente.

### Scope

- `lib/redux/api/commerceApi.ts`
- `app/ventas/page.tsx`
- endpoints nuevos o consolidados necesarios

### Subtasks

- [ ] `08.1` Crear endpoint canónico para ventas/retiros
- [ ] `08.2` Migrar `commerceApi.getSales`
- [ ] `08.3` Eliminar parsing financiero en cliente
- [ ] `08.4` Verificar cálculos de disponible/reservado

### Exit Criteria

- [ ] La UI de ventas/retiros no reconstruye negocio financiero localmente

## Phase 09

### Title

Integridad de publicación de contenido y chat uploads

### Goal

Evitar storage huérfano y persistencia parcial.

### Scope

- `app/api/posts/create/route.ts`
- `app/api/direct-chats/threads/[id]/messages/route.ts`
- helpers de storage asociados

### Subtasks

- [ ] `09.1` Definir estrategia de compensación para posts
- [ ] `09.2` Definir estrategia de compensación para chat uploads
- [ ] `09.3` Implementar cleanup o staging seguro
- [ ] `09.4` Verificar fallos parciales

### Exit Criteria

- [ ] Los flujos no dejan objetos huérfanos sin reconciliación

## Phase 10

### Title

Archivado de cuenta seguro y recuperable

### Goal

Rehacer la secuencia destructiva de cuenta para soportar fallos intermedios.

### Scope

- `app/api/account/delete/route.ts`
- datos relacionados de identidad y relaciones

### Subtasks

- [ ] `10.1` Separar preparación, ejecución y cierre
- [ ] `10.2` Introducir marcadores de proceso o reintento seguro
- [ ] `10.3` Documentar invariantes post-archivo

### Exit Criteria

- [ ] El archivado no deja estados parciales opacos

## Phase 11

### Title

Limpieza final del legado

### Goal

Retirar fallbacks y stores legacy ya sin consumers.

### Scope

- `notifications` como storage legacy
- `user_meta` redundante en dominios ya migrados
- normalizaciones legacy dispersas
- sync por `window` en flujos críticos

### Subtasks

- [ ] `11.1` Confirmar consumers restantes
- [ ] `11.2` Retirar dual-read/dual-write antiguos
- [ ] `11.3` Eliminar normalizaciones silenciosas innecesarias
- [ ] `11.4` Actualizar documentación final

### Exit Criteria

- [ ] No quedan stores legacy activos para dominios críticos
- [ ] El sistema final tiene una fuente de verdad por dominio clave

## Execution Log

Usar esta sección para retomar una sesión cortada:

- `2026-04-25`: roadmap creado, listo para comenzar por Phase 00.

## Acceptance Criteria

- Existe un plan de ejecución completo de todo el proyecto.
- Cada fase tiene objetivo, alcance, subtareas y criterio de salida.
- El archivo funciona como índice de avance y punto de reanudación.
- El roadmap permite continuar aunque la sesión se corte por tiempo o tokens.
