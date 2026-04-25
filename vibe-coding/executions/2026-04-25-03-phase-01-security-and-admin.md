# 2026-04-25-03 Phase 01 Security And Admin

## Status

- phase: `01`
- state: `in_progress`
- last_safe_resume_point: `admin-db-only-and-payouts-meta-dual-read`

## Scope

- `app/api/mercadopago/webhook/route.ts`
- `lib/mercadopago.ts`
- `app/api/media/access/route.ts`
- `lib/server/auth/roles.ts`
- `app/api/admin/access/route.ts`
- `app/api/admin/users/[id]/roles/route.ts`

## Ambiguity Register

- `A-01`
  - topic: `Mercado Pago webhook verification mode`
  - why_it_is_ambiguous: no existe evidencia en el repo de una secret dedicada ya configurada para verificar el webhook.
  - possible_safe_assumption: soportar verificación por firma si existe secret y por token si existe token, manteniendo compatibilidad temporal si el entorno todavía no expone ninguno.
  - blocks_phase: `no`
  - status: `open`

## Progress

- Se detectó que el webhook procesa pagos sin autenticación.
- Se detectó que admin todavía puede resolverse por fallback legacy en `lib/server/auth/roles.ts`.
- Se detectó que `media/access` necesita endurecimiento adicional, pero primero se corrige la fuente central de authz.
