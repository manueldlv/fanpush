# Audit Stage Report

## Metadata

- `plan_id`: `2026-04-25-01-critical-technical-audit`
- `stage_id`: `stage-05`
- `title`: `Consistencia transversal de reglas de negocio`
- `status`: `completed`
- `owner`: `vibe-agent`
- `date`: `2026-04-25`
- `domains_covered`: `withdrawals`, `commissions`, `earnings`, `settings`, `tips`, `admin/authz`

## Objective

Detectar reglas de negocio definidas de más de una forma, con naming inconsistente o dependiendo de estructuras legacy distintas según el flujo.

## Review Method

Se cruzaron utilidades de dominio, repositorios y endpoints:

- `lib/withdrawals.ts`
- `lib/earnings.ts`
- `lib/userCommission.ts`
- `lib/payouts.ts`
- `lib/userMeta.ts`
- `lib/server/repositories/withdrawals.ts`
- `lib/server/repositories/ledger.ts`
- `lib/redux/api/settingsApi.ts`
- `app/api/me/route.ts`

## Critical Findings

### Finding

- `id`: `RULES-P1-01`
- `severity`: `P1`
- `domain`: `withdrawals`
- `title`: `El dominio de retiros usa dos taxonomías de estado distintas y una traducción legacy intermedia`
- `files`:
  - `lib/withdrawals.ts:1`
  - `lib/server/repositories/withdrawals.ts:15`
  - `lib/server/repositories/ledger.ts:552`
  - `lib/server/repositories/ledger.ts:648`
- `routes`:
  - `withdrawals/request`
  - `withdrawals/[id]/cancel`
  - ventas/retiros UI
- `data_surfaces`:
  - `withdrawal_requests.status`
  - `WithdrawalStatus`
  - `ledger_transactions.status`
- `business_rule`: `el estado de un retiro debería tener un vocabulario único`
- `evidence`: `la tabla usa `requested/reserved/paid/rejected/cancelled`; el frontend legacy usa `requested/sent/rejected`; `mapTableStatusToLegacy` colapsa `requested` y `reserved` en un solo valor, y `cancelled` también cae como `rejected`.`
- `risk`: `distintos consumidores pueden perder información de transición real o tratar igual casos que el backend distingue.`
- `why_it_is_critical`: `retener o liberar dinero depende del estado exacto; colapsar estados rompe trazabilidad del proceso financiero.`

### Finding

- `id`: `RULES-P1-02`
- `severity`: `P1`
- `domain`: `earnings`
- `title`: `La ganancia del creador se calcula mezclando tablas estructuradas con parsing de texto en notificaciones`
- `files`:
  - `lib/earnings.ts:7`
  - `lib/earnings.ts:68`
  - `lib/server/repositories/ledger.ts:148`
- `routes`:
  - `/api/me`
  - ventas/settings/balance indirectamente
- `data_surfaces`:
  - `purchases`
  - `direct_message_purchases`
  - `notifications(type=tip)`
- `business_rule`: `earnings y tips deberían salir de registros financieros estructurados`
- `evidence`: `loadCreatorEarnings` suma purchases y direct_message_purchases, pero las propinas las deriva de `notifications.message` usando regex con `parseTipAmountFromMessage`.`
- `risk`: `si cambia el copy del mensaje, el idioma o el formato monetario, el cálculo financiero cambia sin que la DB “financiera” haya variado.`
- `why_it_is_critical`: `es una regla de negocio de dinero implementada sobre texto libre.`

### Finding

- `id`: `RULES-P1-03`
- `severity`: `P1`
- `domain`: `commissions`
- `title`: `La regla de comisión incluye normalización silenciosa de filas legacy invertidas en la capa de lectura`
- `files`:
  - `lib/userCommission.ts:18`
  - `lib/userCommission.ts:62`
  - `lib/server/repositories/ledger.ts:207`
- `routes`:
  - cualquier flujo que calcule share del creador
- `data_surfaces`:
  - `user_commission_profiles`
  - consumers de `creatorShare/platformShare`
- `business_rule`: `la comisión efectiva debería quedar corregida en datos, no reinterpretada en cada lectura`
- `evidence`: `coerceUserCommissionProfile` reescribe silenciosamente 30/70 a 70/30 por una inversión legacy, y otros caminos como el SQL de compra directa también contienen corrección propia.`
- `risk`: `la regla verdadera de comisión deja de estar en el dato y pasa a estar repartida entre lectores.`
- `why_it_is_critical`: `si una ruta olvida la normalización, dinero y reporting pueden divergir.`

### Finding

- `id`: `RULES-P2-04`
- `severity`: `P2`
- `domain`: `settings/payout`
- `title`: `La regla de “perfil de cobro completo” depende de dónde se leyó el dato: notifications o user_meta`
- `files`:
  - `lib/payouts.ts:1`
  - `lib/userMeta.ts:1`
  - `lib/redux/api/settingsApi.ts:150`
  - `app/api/withdrawals/request/route.ts:39`
  - `app/api/me/route.ts:49`
- `routes`:
  - `settings`
  - `withdrawals/request`
  - `/api/me`
- `data_surfaces`:
  - `user_meta(payout.profile)`
  - `notifications(type=payout_profile)`
- `business_rule`: `tener o no tener payout profile no debería depender del storage consultado`
- `evidence`: `settings` y `/api/me` aceptan `user_meta` como fuente primaria con fallback a `notifications`, pero `withdrawals/request` valida solo `notifications`.`
- `risk`: `un usuario puede tener payout profile visible en una parte del producto y ser rechazado en otra si los dos stores se desalinean.`
- `why_it_is_critical`: `afecta retiros reales y muestra una regla implementada distinto según el punto de entrada.`

## Cross-System Inconsistencies

- dinero estructurado convive con dinero inferido desde mensajes;
- estados de retiro en DB, ledger y UI no son isomórficos;
- comisión efectiva se corrige en lectura, no solo en migración/datos;
- payout/settings existe en doble storage con consumidores que no leen igual.

## Open Questions

- Si todavía quedan consumidores de `notifications` como fuente primaria para profile/payout/commission fuera de las rutas ya inspeccionadas.

## Stage Exit

La inconsistencia de reglas de negocio es real y transversal. No se limita a naming: afecta dinero, retiros, comisiones y elegibilidad operativa. El consolidado final prioriza estas zonas para un plan de remediación posterior.
