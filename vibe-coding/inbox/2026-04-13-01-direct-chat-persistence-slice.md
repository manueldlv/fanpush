# Direct chat persistence slice

- Objetivo: empezar a cerrar Bloque 1 y 2 conectando `/mensajes` al backend real.
- Alcance de esta tanda:
  - remover `Inbox admin` del panel admin
  - conectar lista de chats, detalle, envío de texto, adjuntos, contenido pago y compra premium al backend de `direct-chats`
  - mover `Personas bloqueadas` en settings a datos reales del backend
- Pendiente para próximas tandas:
  - terminar de reemplazar mocks remanentes del chat
  - aplicar y validar la migración SQL de direct chats en el entorno real
  - revisar badges/unread y experiencia end-to-end con data persistida
