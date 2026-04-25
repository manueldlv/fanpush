# Changelog

- date: 2026-04-25
- id: 2026-04-25-04-direct-chat-realtime-and-presence-plan
- type: plan
- requested_by: matias
- status: approved

## Summary

Se agrego un nuevo plan tecnico para migrar el chat directo a una experiencia realtime sobre Supabase, preservando la API actual como camino canonico de escritura y separando eventos persistentes de estados efimeros de presencia.

## Includes

- arquitectura recomendada para realtime de mensajes
- uso sugerido de `postgres_changes` y `presence`
- reglas de negocio a preservar
- estrategia de reconciliacion y fallback
- fases de ejecucion
- plan detallado de microinteracciones:
  - escribiendo
  - grabando audio
  - preparando foto/video/pack
  - subiendo contenido
  - presencia contextual en el thread
