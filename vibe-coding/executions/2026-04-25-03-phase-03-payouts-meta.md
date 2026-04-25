# 2026-04-25-03 Phase 03 Payouts Meta

## Status

- phase: `03`
- state: `in_progress`
- last_safe_resume_point: `migrate-remaining-payout-profile-consumers`

## Changes

- Se agregó la migración `supabase/migrations/20260425000012_payouts_meta.sql`.
- Se creó `lib/payoutMeta.ts` con lectura y escritura tolerante a ausencia de tabla.
- `settingsApi` ahora escribe en `payouts_meta` y sigue manteniendo compatibilidad temporal con legacy.
- `/api/me`, `withdrawals/request`, `commerceApi` y `admin/dashboard` priorizan `payouts_meta` y caen a legacy solo si hace falta.

## Validation

- `npm run build`
- Resultado: OK

## Pending

- Reducir todavía más los readers directos de `notifications` para `payout_profile`.
- Decidir cuándo retirar la compatibilidad con `user_meta` para payout data.
- Mantener `notifications` solo como historial/mirror hasta migrar todos los consumers.
