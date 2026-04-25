# Plan

- id: 2026-04-25-03-phase-03-payouts-meta-detailed
- title: Fase 03 detallada - canonicalizacion de datos de cobro en payouts_meta
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Mover los datos operativos de cobro a una fuente estructurada única: `payouts_meta`.

## Why This Phase Exists

Los datos de cobro hoy están dispersos y mezclados con superficies que no son semánticamente correctas, como `notifications` y `user_meta`. La regla cerrada es que la fuente oficial pase a ser una tabla `payouts_meta` con `meta_key/meta_value`.

## Canonical Business Decision

- la tabla canónica es `payouts_meta`
- el dato puede no existir para usuarios no autores
- no se precrea por defecto
- una clave inicial válida es `accounts.default`
- `notifications` no debe seguir como storage operativo

## Primary Sources To Read

- auditoría `stage 04`, `stage 05`, `stage 06`
- migraciones actuales de withdrawals/payouts/metadata
- `app/api/me/route.ts`
- `app/api/withdrawals/request/route.ts`
- `lib/payouts.ts`
- `lib/server/**` relacionado con settings y payouts
- `lib/redux/api/settingsApi.ts`
- UI de settings y retiros

## Business Rules To Infer And Preserve

- un usuario puede no tener cuenta de cobro configurada
- solo cuando hay datos cargados deben aparecer disponibles para el flujo de retiro
- las lecturas actuales no deben romperse durante la migración

## What Will Change

- creación de la estructura `payouts_meta`
- definición del contrato de `meta_key` para cuentas
- dual-read temporal con preferencia por `payouts_meta`
- escrituras nuevas dirigidas solo a `payouts_meta`
- aislamiento de legacy como lectura de compatibilidad

## Search Plan

Buscar:

- todos los lugares que leen alias/titular/documento/datos bancarios
- todas las escrituras de payout data desde settings o retiro
- todos los consumers que usan `notifications` para inferir estos datos

Cruzar:

- formulario UI -> endpoint/settings API -> helper server -> persistencia -> `/api/me` y pantallas consumidoras

## Ambiguity Handling

Si aparece más de una forma histórica de guardar la cuenta:

- registrar los formatos encontrados
- definir la normalización objetivo
- documentar si hace falta un lector de compatibilidad
- no inventar campos nuevos sin rastrear primero el shape actual

## Validation Checklist

- [ ] existe `payouts_meta` como fuente oficial
- [ ] las escrituras nuevas ya no van a `notifications`
- [ ] `/api/me`, settings y retiros leen la misma fuente
- [ ] un usuario sin cuenta configurada sigue siendo un caso válido

## Exit Criteria

- la cuenta de cobro deja de vivir en surfaces ambiguas
- quedó un contrato explícito y rastreable para la data operativa de payout

## Resume Instructions

Retomar desde el último consumer que siga leyendo `notifications` o `user_meta` como fuente primaria de datos de cobro.
