# Plan

- id: 2026-04-25-03-phase-10-account-archive-detailed
- title: Fase 10 detallada - archivado de cuenta con secuencia segura
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Rehacer archivado o desactivación de cuenta para que tenga secuencia segura, trazable y consistente con dependencias del sistema.

## Why This Phase Exists

Archivar una cuenta toca auth, perfil, contenido, chats, compras, posibles retiros y notificaciones. Si la secuencia es incompleta o ambigua puede dejar datos huérfanos o permisos inconsistentes.

## Primary Sources To Read

- auditoría `stage 04` y `stage 06`
- endpoints/settings de cuenta
- helpers de auth/profile
- tablas dependientes de usuario, chats, posts, purchases, withdrawals
- cualquier flujo existente de delete/archive/deactivate

## Business Rules To Infer And Preserve

- si la cuenta se archiva o se borra lógicamente
- qué debe seguir visible para compradores o interlocutores previos
- cómo se tratan saldos, retiros pendientes o compras históricas

## What Will Change

- definición explícita de secuencia de archivado
- bloqueos previos si hay dependencias críticas abiertas
- coherencia entre auth, perfil y contenido archivado
- documentación del impacto esperado por entidad dependiente

## Search Plan

Buscar:

- cualquier endpoint o action de delete/archive
- checks incompletos sobre saldo o retiros pendientes
- entidades que sigan activas después de archivado sin política clara

Cruzar:

- solicitud de archivado -> validaciones previas -> cambios persistidos -> lectura posterior de perfil/auth/contenido

## Ambiguity Handling

Si aparece una decisión de producto no definida, por ejemplo visibilidad de contenido comprado tras archivado:

- registrar la pregunta en esta fase
- identificar exactamente qué entidades afecta
- no asumir borrado duro si la relación histórica parece importante para negocio

## Validation Checklist

- [ ] existe secuencia clara de archivado
- [ ] el flujo no deja auth y perfil en estados contradictorios
- [ ] se contemplan dependencias críticas abiertas
- [ ] la política por entidad quedó documentada

## Exit Criteria

- archivar cuenta deja de ser un flujo peligroso o implícito
- se puede razonar técnicamente qué pasa con cada dependencia principal

## Resume Instructions

Retomar desde la siguiente dependencia de usuario no mapeada dentro de la secuencia de archivado.
