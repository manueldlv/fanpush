# Plan

- id: 2026-04-25-03-phase-09-content-and-chat-persistence-detailed
- title: Fase 09 detallada - integridad de persistencia en publicaciones y chat
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Eliminar writes parciales o secuencias débiles en publicación de contenido y adjuntos de chat.

## Why This Phase Exists

La auditoría marcó riesgo de pantallas que parecen funcionar pero dejan persistencia parcial, especialmente alrededor de contenido premium, uploads y mensajes directos.

## Primary Sources To Read

- auditoría `stage 04` y `stage 06`
- endpoints de posts y uploads
- endpoints y servicios de direct chats
- Cloudinary/Supabase storage helpers
- componentes de creación de posts y mensajes premium

## Business Rules To Infer And Preserve

- cuándo un post o mensaje debe considerarse publicado
- cuándo un adjunto premium queda accesible o no
- qué operaciones deben ser atómicas desde la mirada del usuario

## What Will Change

- revisión y endurecimiento de secuencias de create/upload/persist
- clarificación de qué write es fuente de verdad
- reducción de estados donde existe archivo sin registro o registro sin archivo usable
- alineación de creación premium entre chat y posts

## Search Plan

Buscar:

- create seguido de upload sin compensación
- upload seguido de insert sin manejo de rollback lógico
- mensajes o posts que se muestran antes de quedar completamente persistidos
- diferencias entre metadata premium y media real disponible

Cruzar:

- acción UI -> upload/storage -> insert/update DB -> lectura posterior del recurso

## Ambiguity Handling

Si una secuencia actual parece intencional pero deja estado parcial:

- documentar el riesgo
- diferenciar “tolerancia temporal” de “inconsistencia real”
- pedir validación solo si cambiar la secuencia altera la experiencia o promesa de negocio

## Validation Checklist

- [ ] post y chat no dejan estados parciales silenciosos
- [ ] los recursos premium tienen criterio claro de accesibilidad
- [ ] upload y persistencia quedaron trazables y consistentes
- [ ] la UI no marca éxito antes de un punto durable mínimo

## Exit Criteria

- publicar contenido y enviar adjuntos deja de depender de secuencias implícitas o frágiles
- se reduce el riesgo de éxito visual sin impacto durable

## Resume Instructions

Retomar desde el siguiente flujo create/upload no auditado de punta a punta.
