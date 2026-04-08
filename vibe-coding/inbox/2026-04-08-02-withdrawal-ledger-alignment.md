# 2026-04-08-02 Withdrawal Ledger Alignment

- Requested by: matias
- Scope: safe
- Status: completed

## Request

Corregir el flujo de retiros porque la solicitud estaba validando contra ganancias teóricas y no contra el balance real del ledger, causando el error `user_balances_cash_available_check`.

## Outcome

- La API de solicitud de retiro ahora valida contra `user_balances.cash_available`.
- La pantalla `Mis ventas` ahora muestra disponible para retirar desde el balance real del ledger.
- El monto visible y el monto retirable quedaron alineados.
