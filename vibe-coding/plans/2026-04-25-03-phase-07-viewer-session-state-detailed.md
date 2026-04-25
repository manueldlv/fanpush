# Plan

- id: 2026-04-25-03-phase-07-viewer-session-state-detailed
- title: Fase 07 detallada - unificacion de viewer, session y contratos de estado cliente
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Eliminar fuentes duplicadas de estado crítico del viewer y hacer explícito el contrato de sincronización cliente-servidor.

## Why This Phase Exists

Hoy viewer/session se duplica entre `sessionApi`, `viewerSlice`, `/api/me` y eventos globales manuales. Eso vuelve frágil la coherencia de balance, compras, perfil y permisos.

## Primary Sources To Read

- auditoría `stage 02`
- `lib/redux/api/sessionApi.ts`
- `lib/redux/slices/viewerSlice.ts`
- `components/AppStateBootstrap.tsx`
- `app/api/me/route.ts`
- consumers de viewer, balance, settings y permisos

## Business Rules To Infer And Preserve

- qué información del viewer debe ser inmediatamente consistente
- qué cambios requieren invalidación o refetch
- qué datos pueden seguir siendo derivados localmente y cuáles no

## What Will Change

- elección de una sola fuente de verdad de viewer
- simplificación de hidratación inicial
- retiro progresivo de eventos globales manuales para coherencia crítica
- definición explícita de invalidaciones después de mutaciones

## Search Plan

Buscar:

- todos los `dispatchEvent`, listeners y refresh manuales
- duplicación entre slice y RTK Query
- mutaciones que no invalidan viewer/balance/settings
- pantallas que reconstruyen estado local en vez de leer la fuente canónica

Cruzar:

- mutación -> invalidación -> `/api/me` o query canónica -> consumidor UI

## Ambiguity Handling

Si un consumer depende de un campo no devuelto por la fuente canónica:

- documentarlo como gap de contrato
- decidir si el campo debe agregarse a la fuente o derivarse explícitamente
- no mantener doble fuente solo por conveniencia temporal

## Validation Checklist

- [ ] viewer tiene una sola fuente primaria
- [ ] balance y permisos no dependen de eventos globales ad hoc
- [ ] las mutaciones críticas invalidan correctamente
- [ ] se reduce la duplicación entre RTK Query y slice legacy

## Exit Criteria

- el estado crítico del usuario es predecible y rastreable
- se reduce el riesgo de UI “parece actualizada” sin persistencia o refetch real

## Resume Instructions

Retomar desde el siguiente consumer que siga leyendo la fuente legacy del viewer o disparando eventos globales manuales.
