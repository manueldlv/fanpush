# Execution

- id: 2026-04-25-03-phase-09-content-and-chat-persistence
- phase: 09
- status: done
- date: 2026-04-25

## Changes Executed

- se agregó `lib/uploadCleanup.ts` para cleanup compensatorio de uploads
- `app/api/posts/create/route.ts` ahora elimina archivos subidos y filas parciales si falla la publicación
- `app/api/direct-chats/threads/[id]/messages/route.ts` ahora limpia archivos subidos si falla la persistencia del mensaje

## Validation

- `npm run build`: OK

## Decision Log

- el rollback de chat se limita al tramo upload -> persistencia del mensaje
- no se hace rollback si falla solo la lectura posterior del thread, para no borrar assets ya referenciados

## Last Safe Resume Point

- fase cerrada
