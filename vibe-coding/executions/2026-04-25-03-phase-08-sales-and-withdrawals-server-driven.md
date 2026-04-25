# Execution

- id: 2026-04-25-03-phase-08-sales-and-withdrawals-server-driven
- phase: 08
- status: done
- date: 2026-04-25

## Changes Executed

- se agregó `app/api/sales/route.ts` como contrato server-driven para ventas y retiros
- `lib/redux/api/commerceApi.ts` dejó de reconstruir ventas financieras con Supabase directo desde cliente
- `ventas` pasó a depender de un endpoint autenticado y de una respuesta canónica

## Validation

- `npm run build`: OK

## Decision Log

- se preservó el shape esperado por `app/ventas/page.tsx` para no romper UI ni reglas visibles
- los retiros se leen solo desde `withdrawal_requests` en este contrato nuevo

## Last Safe Resume Point

- fase cerrada
