# Execution

- Se removió el acceso visual a `Inbox admin` desde `/admin`.
- `/admin/inbox` ahora redirige a `/admin`.
- `/mensajes` dejó de depender sólo de estado local para:
  - cargar threads reales
  - abrir un chat real
  - enviar texto
  - enviar foto simple
  - enviar contenido pago
  - comprar contenido pago dentro del chat
  - pin / unread / delete / block
- `/settings` ahora consulta usuarios bloqueados desde `/api/direct-chats/blocked` y desbloquea con `DELETE`.
- Se corrigió tipado pendiente en `lib/server/repositories/direct-chats.ts`.
- Validación ejecutada: `npm run build`

## Riesgos abiertos

- La migración `supabase/migrations/20260413000014_direct_chats.sql` debe existir en el entorno donde se pruebe.
- La UI de `/mensajes` todavía tiene componentes visuales heredados del mock anterior, aunque ya quedó conectada al backend base.
