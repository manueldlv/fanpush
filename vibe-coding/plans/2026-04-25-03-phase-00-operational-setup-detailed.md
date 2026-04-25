# Plan

- id: 2026-04-25-03-phase-00-operational-setup-detailed
- title: Fase 00 detallada - preparacion operativa, trazabilidad y protocolo de ejecucion
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Preparar el terreno para ejecutar el resto del roadmap sin perder trazabilidad, sin mezclar fases, y sin dejar decisiones ambiguas fuera de registro.

## Why This Phase Exists

Las fases siguientes van a tocar auth, dinero, persistencia y reglas de negocio. Antes de cambiar código hace falta fijar:

- cómo se marca progreso
- dónde se documentan ambigüedades
- cómo se registra cada decisión
- cómo se retoma si la sesión se corta
- cómo se evita ejecutar fuera de secuencia

## Deliverables

- `vibe-coding/executions/2026-04-25-03-phase-00-setup.md`
- actualización del roadmap maestro con links a documentos detallados
- convención estable para `execution log`, `resume point` y `ambiguities`
- checklist transversal de validación por fase

## Primary Sources To Read

- `vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md`
- `vibe-coding/plans/2026-04-25-02-critical-remediation-execution-plan.md`
- `vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-06-critical-findings-summary.md`
- `vibe-coding/registry/index.json`
- `plugins/vibe-coding/AGENTS.md`
- `plugins/vibe-coding/policies/scope.md`

## What Will Change

- crear la estructura documental para ejecutar por lotes
- enlazar cada fase con su documento detallado
- definir una sección fija de ambiguidades por fase
- definir una sección fija de validación por fase
- definir cómo se marca el último subtask ejecutado

## Execution Procedure

1. Crear el execution doc de fase 00.
2. Convertir el roadmap maestro en índice navegable por fase.
3. Definir el formato de reanudación:
   - `current_phase`
   - `current_subtask`
   - `last_safe_commit_point`
   - `next_expected_action`
4. Definir el formato de dudas:
   - `Ambiguity Register`
   - `Question`
   - `Why It Blocks`
   - `Default Assumption`
   - `Status`
5. Definir el formato de validación transversal:
   - persistencia
   - auth/authz
   - invalidación/cache
   - compatibilidad temporal

## Ambiguity Handling

Si durante cualquier fase aparece una regla de negocio que no se puede inferir con seguridad:

1. no se fuerza una implementación especulativa
2. se agrega la duda al `Ambiguity Register` del documento detallado de esa fase
3. se agrega una línea resumida al `Execution Log` del roadmap maestro
4. se sigue con subtareas no bloqueadas de la misma fase si existen
5. si bloquea el cierre de fase, la fase queda en `blocked`

## Where Questions Must Be Documented

- detalle completo: documento detallado de la fase correspondiente
- resumen operativo: `Execution Log` del roadmap maestro
- evidencia técnica adicional: execution doc de la fase

## Validation Checklist For This Phase

- [ ] existe un execution doc base para arrancar
- [ ] el roadmap maestro enlaza documentos detallados
- [ ] cada fase tiene protocolo explícito de ambigüedad
- [ ] cada fase tiene protocolo explícito de reanudación
- [ ] quedó definida la checklist transversal de validación

## Exit Criteria

- el roadmap dejó de ser solo estratégico y pasó a ser ejecutable
- cualquier sesión futura puede retomar sin reconstruir contexto
- quedó definido dónde registrar dudas y blockers antes de tocar código crítico

## Resume Instructions

Si la sesión se corta en fase 00:

- abrir el roadmap maestro
- leer `Current Phase`
- abrir el execution doc de fase 00
- continuar desde el primer item no marcado en `Setup Checklist`
