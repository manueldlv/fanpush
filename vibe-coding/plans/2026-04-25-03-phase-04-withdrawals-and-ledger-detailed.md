# Plan

- id: 2026-04-25-03-phase-04-withdrawals-and-ledger-detailed
- title: Fase 04 detallada - retiros, reserva de usuario y payout real
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Convertir retiros en un flujo técnicamente coherente, con una entidad operativa canónica y una separación nítida entre reserva del usuario y payout real.

## Canonical Business Decision

- `withdrawal_requests` es la entidad de negocio canónica
- al crear una solicitud se reserva saldo del usuario
- eso no equivale a payout real de plataforma
- el egreso real de plataforma ocurre al pagar efectivamente
- si existe `payout_request` en ledger, su semántica debe ser reserva interna del usuario y no payout final

## Why This Phase Exists

Retiros es una de las zonas más ambiguas del sistema. Hoy mezcla workflow de producto, ledger, status naming inconsistente y legacy notifications. Sin esta fase no se puede estabilizar ventas, balances ni admin de pagos.

## Primary Sources To Read

- auditoría `stage 04`, `stage 05`, `stage 06`
- migraciones de `withdrawal_requests`, ledger y payouts
- `app/api/withdrawals/**`
- `app/api/admin/withdrawals/**`
- `lib/ledger/**`
- `lib/payouts/**`
- páginas de ventas y retiros
- componentes admin vinculados

## Business Rules To Infer And Preserve

- el usuario no puede gastar dos veces saldo ya solicitado a retiro
- pedir retiro no significa que la plataforma ya pagó
- rechazo o cancelación deben tener semántica explícita
- pago real debe quedar trazable como evento financiero distinto

## What Will Change

- definición de una máquina de estados única para `withdrawal_requests`
- documentación en código de cada transición válida
- alineación entre API de request, cancel, reject, pay y vistas admin
- aclaración o renombre semántico del ledger asociado
- reducción de dependencia en texto libre o notifications legacy

## Search Plan

Buscar:

- todos los estados usados hoy para retiros
- todas las ramas que cambian `cash_available`, `cash_reserved` u otros campos parecidos
- todo uso de `payout_request`, `payout_paid`, `withdrawal`, `reserved`, `sent`, `paid`
- lecturas de retiros desde ventas, admin y perfil

Cruzar:

- acción UI -> API -> helper -> `withdrawal_requests` -> ledger -> lectura posterior en UI

## Ambiguity Handling

Si aparece una transición no documentada o un estado histórico sin semántica clara:

- agregarlo al `Ambiguity Register`
- documentar dónde aparece y qué efectos produce
- no colapsarlo con otro estado solo por parecido de nombre
- pedir definición solo si cambia negocio; si no cambia negocio, documentar la equivalencia técnica

## Validation Checklist

- [ ] `withdrawal_requests` quedó como workflow canónico
- [ ] reserva del usuario y payout real son eventos distintos
- [ ] la UI y admin leen la misma interpretación de estado
- [ ] cancelación/rechazo no dejan efectos contables incoherentes
- [ ] no se depende de `notifications.message` como fuente de verdad

## Exit Criteria

- cualquier lector del código puede entender el flujo completo de retiros
- las transiciones dejan de estar implícitas o repartidas
- el ledger deja de confundirse con la solicitud operativa

## Resume Instructions

Retomar desde la primera transición de estado no mapeada en la máquina canónica y revisar después los consumers pendientes.
