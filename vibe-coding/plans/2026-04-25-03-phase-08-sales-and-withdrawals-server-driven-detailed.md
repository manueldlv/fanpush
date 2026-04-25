# Plan

- id: 2026-04-25-03-phase-08-sales-and-withdrawals-server-driven-detailed
- title: Fase 08 detallada - ventas y retiros sobre lecturas server-driven consistentes
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Dejar ventas y retiros como superficies de lectura consistentes, armadas desde servidor y no desde reconstrucción dispersa en cliente.

## Why This Phase Exists

Las páginas de ventas y retiros hoy mezclan Supabase directo, parsing de notificaciones, cálculos cliente y múltiples fuentes de verdad. Después de estabilizar payouts, retiros y earnings, estas pantallas deben pasar a leer una proyección canónica.

## Primary Sources To Read

- auditoría `stage 02`, `stage 04`, `stage 05`, `stage 06`
- páginas `ventas`, `retiros` o equivalentes
- `discoveryApi` y APIs específicas usadas por esas páginas
- helpers server de ledger, purchases, withdrawals, tips
- componentes que muestran KPIs y listados

## Business Rules To Infer And Preserve

- qué KPIs son informativos y cuáles son contables
- qué diferencias deben existir entre monto disponible, reservado, pagado y total histórico
- qué fechas o filtros usa negocio para ventas y retiros

## What Will Change

- mover lecturas críticas a endpoints/server helpers canónicos
- reducir acceso directo a Supabase desde cliente para finanzas
- normalizar shape de respuesta de ventas/retiros
- hacer explícitos los KPIs derivados vs los persistidos

## Search Plan

Buscar:

- uso directo de Supabase en páginas financieras
- cálculos de sumatorias en cliente
- joins o mezclas entre notifications, ledger y requests
- diferencias entre la vista usuario y la vista admin

Cruzar:

- tabla o ledger fuente -> endpoint server -> RTK Query -> componente de ventas/retiros

## Ambiguity Handling

Si un KPI actual mezcla conceptos distintos:

- documentarlo en la fase
- separar “métrica informativa heredada” de “valor financiero real”
- pedir validación solo si la separación cambia lo que negocio considera correcto

## Validation Checklist

- [ ] ventas y retiros leen datos server-driven
- [ ] no quedan cálculos críticos solo en cliente
- [ ] la UI distingue derivado informativo vs estado financiero real
- [ ] admin y usuario consumen contratos coherentes

## Exit Criteria

- las superficies financieras dejan de ser reconstrucciones débiles del cliente
- la lectura del negocio pasa a depender de contratos explícitos

## Resume Instructions

Retomar desde la siguiente página financiera que siga leyendo Supabase directo o reconstruyendo dinero en cliente.
