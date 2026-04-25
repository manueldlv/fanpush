# Audit Stage Report

## Metadata

- `plan_id`:
- `stage_id`:
- `title`:
- `status`: `not_started` | `in_progress` | `completed`
- `owner`:
- `date`:
- `domains_covered`:

## Objective

Describir que parte critica del sistema se esta auditando en esta etapa.

## Review Method

Documentar como se cruzo la informacion.

- flujos seguidos
- endpoints inspeccionados
- slices o caches revisadas
- repositorios/helpers revisados
- tablas o buckets relacionados

## Evidence Map

Listar las piezas inspeccionadas.

- rutas UI
- componentes
- endpoints
- helpers server-side
- tablas o migraciones

## Critical Findings

Solo incluir `P0`, `P1` o `P2`.

### Finding

- `id`:
- `severity`:
- `domain`:
- `title`:
- `files`:
- `routes`:
- `data_surfaces`:
- `business_rule`:
- `evidence`:
- `risk`:
- `why_it_is_critical`:

Repetir un bloque por hallazgo.

## Cross-System Inconsistencies

Documentar reglas implementadas distinto segun capa o flujo.

## Open Questions

Registrar dudas reales que bloqueen una conclusion fuerte.

## Stage Exit

- resumen corto de lo encontrado
- que etapa deberia seguir despues
- dependencias para continuar
