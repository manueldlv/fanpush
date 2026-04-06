# Request

- title: Agregar propina on/off en monetizacion de publicaciones
- requester: matias
- functional_goal: Permitir activar o desactivar propinas por publicacion desde el paso de monetizacion, sin precio propio, y mostrar el boton `Enviar propina` en feed y popup solo cuando esa opcion este activa.
- constraints:
  - La propina no debe pedir monto fijo en crear.
  - Debe persistirse con la publicacion para que el feed, perfil y modal lo respeten.
  - Mantener compatibilidad con publicaciones existentes que no tengan esa metadata.
- current_status: completed
- scope: safe
