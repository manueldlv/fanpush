# 2026-04-25-03 Phase 04 Withdrawals And Ledger

## Status

- phase: `04`
- state: `in_progress`
- last_safe_resume_point: `align-withdrawal-views-and-admin-workflow`

## Changes

- Se separó en helpers legacy el monto `reserved` del monto `paid`.
- `ensureLegacyCreatorBalanceBaseline()` ya no trata retiros `sent` como saldo reservado.
- La baseline ahora imputa retiros pagados a `lifetime_withdrawn` y deja `cash_reserved` solo para solicitudes abiertas.
- `ventas` ahora usa `withdrawal_requests` como fuente primaria y deja `notifications` solo como compatibilidad legacy.
- `admin/dashboard` ahora usa `withdrawal_requests` como fuente primaria para retiros pendientes.

## Validation

- `npm run build`
- Resultado: OK

## Pending

- Clarificar y unificar la máquina de estados visible de retiros entre user/admin.
- Reducir dependencia de `notifications` como espejo operativo de retiros.
