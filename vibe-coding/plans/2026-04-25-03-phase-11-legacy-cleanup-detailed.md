# Plan

- id: 2026-04-25-03-phase-11-legacy-cleanup-detailed
- title: Fase 11 detallada - limpieza final de legado y consolidacion semantica
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Retirar compatibilidades temporales y dejar el proyecto con una semántica más única, legible y mantenible.

## Why This Phase Exists

Las fases anteriores necesitan compatibilidad temporal para no romper todo junto. Esta fase existe para cerrar la transición y evitar que el proyecto quede con dos modelos activos indefinidamente.

## Primary Sources To Read

- todas las fases previas y sus execution docs
- roadmap maestro
- consumers legacy marcados durante migraciones
- `notifications`, `user_meta`, fallbacks de admin, viewers legacy, naming financiero disperso

## Business Rules To Preserve

- ninguna compatibilidad temporal debe quitarse antes de verificar todos sus consumers
- no se deben romper lecturas históricas que aún son necesarias como archivo o referencia

## What Will Change

- retiro final de dual-read o dual-write temporales
- limpieza de helpers legacy
- normalización final de nombres y comentarios semánticos
- documentación final de la arquitectura canónica post-remediación

## Search Plan

Buscar:

- `TODO legacy`, readers transitorios, fallbacks temporales
- referencias aún vivas a `notifications` o `user_meta` como fuente operativa
- nombres de kinds o estados que ya no representen la semántica real
- comentarios o adapters temporales creados en fases anteriores

Cruzar:

- matriz de consumers migrados -> lector legacy restante -> riesgo de corte

## Ambiguity Handling

Si aparece un consumer que todavía depende del legado y no estaba inventariado:

- registrar el caso
- reabrir temporalmente la dependencia en el roadmap si corresponde
- no borrar la compatibilidad antes de migrarlo

## Validation Checklist

- [ ] no quedan fuentes dobles innecesarias
- [ ] las compatibilidades temporales fueron removidas con inventario completo
- [ ] la semántica final quedó documentada
- [ ] el sistema crítico ya no depende de legado ambiguo

## Exit Criteria

- el proyecto termina con un modelo más único y explícito
- el código crítico es más entendible para humanos y para futuros LLMs

## Resume Instructions

Retomar desde el siguiente fallback legacy no retirado y verificar antes su matriz de consumers.
