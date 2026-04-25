# Plan

- id: 2026-04-25-03-phase-06-purchases-core-detailed
- title: Fase 06 detallada - core canónico de compras internas y externas
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Unificar la lógica de compras para que checkout interno, finalize externo y lecturas de compras respondan a un mismo núcleo de negocio.

## Why This Phase Exists

Compras hoy aparece repartida entre checkout, finalize, repositorios, lecturas agregadas y flujos especiales para posts y mensajes premium. Eso aumenta riesgo de doble regla, writes parciales e inconsistencias silenciosas.

## Primary Sources To Read

- auditoría `stage 01`, `stage 03`, `stage 04`, `stage 05`, `stage 06`
- `app/api/purchases/**`
- `app/api/checkout/**`
- handlers de Mercado Pago/finalize
- `commerceApi`
- helpers y repositorios de compras
- direct chats premium
- feed/perfil donde se consume estado de compra

## Business Rules To Infer And Preserve

- qué cuenta como compra exitosa
- cuándo un contenido premium queda desbloqueado
- diferencias entre compra de post y compra de mensaje
- cómo impacta compra interna vs externa en saldo y ledger

## What Will Change

- definición de un flow canónico de compra exitosa
- reducción de duplicación entre finalize, checkout y agregadores
- centralización de writes de compra y unlock
- alineación entre API de lectura y la fuente real de persistencia

## Search Plan

Buscar:

- todos los puntos que crean compras
- todos los puntos que consultan si algo está comprado
- todos los lugares donde se construye la lista de purchases
- diferencias entre post purchases y premium message purchases

Cruzar:

- acción de compra -> proveedor o saldo interno -> write -> unlock -> lectura de compras -> UI

## Ambiguity Handling

Si aparece una regla distinta para post y mensaje premium:

- documentarla por separado
- confirmar si la diferencia es negocio real o drift histórico
- no unificar por estética si cambia semántica real de unlock o cobro

## Validation Checklist

- [ ] hay una semántica clara y única para compra exitosa
- [ ] post y premium message no tienen divergencias accidentales
- [ ] las lecturas de purchases salen de persistencia consistente
- [ ] finalize y checkout no compiten como dos motores diferentes

## Exit Criteria

- la compra queda modelada como un caso de uso rastreable de punta a punta
- se reduce el riesgo de éxito visual sin persistencia real

## Resume Instructions

Retomar desde el siguiente punto de entrada de compra no mapeado al flujo canónico.
