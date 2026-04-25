# Plan

- id: 2026-04-25-03-phase-05-earnings-and-tips-detailed
- title: Fase 05 detallada - earnings y propinas desde fuentes estructuradas
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Eliminar dependencia crítica en parsing de texto libre para earnings, ventas y propinas.

## Why This Phase Exists

Parte del dinero y de las páginas de ventas se reconstruye desde `notifications.message` o metadata débil. Eso es riesgoso, difícil de auditar y frágil para futuros cambios.

## Primary Sources To Read

- auditoría `stage 02`, `stage 04`, `stage 05`, `stage 06`
- páginas de ventas y ganancias
- `notifications` readers
- ledger/commerce helpers
- direct chats premium y tips
- endpoints que generen eventos de propina o earning

## Business Rules To Infer And Preserve

- una propina debe producir un efecto financiero explícito
- una compra premium debe poder verse en ventas sin interpretar strings
- earnings por posts, mensajes o tips deben seguir distinguiéndose si hoy negocio los diferencia

## What Will Change

- identificar la fuente estructurada correcta para cada earning
- mover consumidores de `notifications.message` a campos estructurados o ledger
- definir una proyección server-driven para ventas/earnings
- dejar `notifications` como surface informativa, no contable

## Search Plan

Buscar:

- todo `JSON.parse`, regex o parsing manual sobre `notifications.message`
- todo cálculo de ventas que combine notificaciones con lecturas sueltas
- eventos de propina y compra premium que no produzcan entidad estructurada obvia

Cruzar:

- evento de compra o tip -> persistencia -> lectura de earnings -> UI de ventas

## Ambiguity Handling

Si aparece un earning que hoy solo existe como texto:

- documentar el caso exacto
- rastrear si existe otra evidencia estructurada
- si no existe, dejarlo marcado como gap de modelado y no asumir montos por inferencia débil sin validación

## Validation Checklist

- [ ] ventas/earnings ya no dependen de texto libre para lógica crítica
- [ ] tips tienen fuente estructurada rastreable
- [ ] compras premium y earnings asociados pueden seguirse desde DB
- [ ] `notifications` queda desacoplado del cálculo contable

## Exit Criteria

- páginas financieras y de ventas dejan de depender de parsing frágil
- el dinero tiene trazabilidad estructurada por tipo de evento

## Resume Instructions

Retomar desde el siguiente consumer que siga parseando `notifications.message` para cálculo crítico.
