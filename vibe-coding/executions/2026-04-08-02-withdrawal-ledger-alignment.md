# 2026-04-08-02 Withdrawal Ledger Alignment

## Changes

- `app/api/withdrawals/request/route.ts`
  - Se dejó de calcular el retiro disponible desde `creatorNet - reserved`.
  - Se usa `ensureLegacyCreatorBalanceBaseline()` y luego `cashAvailable` del snapshot real.
- `lib/redux/api/commerceApi.ts`
  - `getSales` ahora devuelve `availableToWithdraw` y `reservedToWithdraw` desde `user_balances`.
- `app/ventas/page.tsx`
  - El bloque de retiros usa el disponible real del ledger en vez del valor teórico derivado de ventas.

## Validation

- `npm run build`
- Resultado: OK
