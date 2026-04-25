# Plan

- id: 2026-04-25-03-phase-01-payments-and-api-security-detailed
- title: Fase 01 detallada - seguridad inmediata de pagos y endpoints sensibles
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Cerrar primero la superficie `P0/P1` de seguridad sin alterar reglas de negocio funcionales.

## Why This Phase Exists

Hay un hallazgo `P0`: el webhook de Mercado Pago puede aceptar requests sin validación robusta. Además hay endpoints con riesgo de autorización débil o superficie de enumeración. Esto se corrige antes de tocar estado o estructura de negocio porque es el riesgo más inmediato.

## Primary Sources To Read

- auditoría `stage 03` de seguridad
- auditoría `stage 06` consolidada
- `app/api/mercadopago/webhook/route.ts`
- `services/mercadopago.ts`
- `lib/payments/**`
- `app/api/media/access/route.ts`
- `app/api/**` que operen sobre compras, mensajes premium, admin o media
- utilidades de auth server-side en `lib/server/auth/**`

## Business Rules To Infer And Preserve

- un pago confirmado solo debe procesarse desde una fuente auténtica
- un endpoint de acceso a media no debe revelar objetos fuera del contexto autorizado
- los errores no deben filtrar información sensible
- la idempotencia del webhook debe conservar la semántica actual de no duplicar efectos

## What Will Change

- autenticación real del webhook
- validación mínima y explícita de payload/evento
- trazabilidad de procesamientos repetidos
- endurecimiento de `media/access`
- chequeos de permisos por recurso donde falten

## Search Plan

Buscar:

- dónde entra Mercado Pago al sistema
- qué handlers procesan `payment`, `merchant_order` o equivalentes
- qué funciones escriben estado de compra o ledger desde webhooks
- qué endpoints aceptan ids arbitrarios del cliente
- qué rutas responden distinto para recursos inexistentes y no autorizados

Cruzar:

- handler API -> helper de pago -> write en DB -> efecto visible en UI

## Implementation Boundaries

No hacer todavía:

- refactor grande de compras
- cambios de naming
- migraciones de negocio

Sí hacer:

- guardrails y validaciones
- registro técnico suficiente para detectar repetición o fraude

## Ambiguity Handling

Si aparece una diferencia entre comportamiento real de Mercado Pago y el handler actual:

- documentar en `Ambiguity Register`
- anotar payload esperado y payload observado en código
- no cambiar semántica de aprobación de compra sin validar si impacta checkout interno o finalize

## Validation Checklist

- [ ] el webhook rechaza requests no autenticados
- [ ] el webhook no duplica efectos observables ante retries
- [ ] `media/access` valida ownership o contexto de compra
- [ ] no quedan respuestas que funcionen como enumerador arbitrario
- [ ] los cambios no alteran reglas de compra existentes más allá del hardening

## Exit Criteria

- los endpoints más sensibles tienen autenticación/autorización explícita
- el mayor `P0` de seguridad queda mitigado sin tocar aún lógica de negocio profunda

## Resume Instructions

Reanudar desde el último endpoint no marcado en el execution doc de fase 01 y verificar primero si ya existe una decisión abierta en `Ambiguity Register`.
