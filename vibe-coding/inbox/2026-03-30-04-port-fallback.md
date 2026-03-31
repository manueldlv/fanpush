# Request

- title: Usar otro puerto si 3000 esta ocupado
- requester: matias
- functional_goal: Hacer que los scripts de arranque usen automaticamente el siguiente puerto libre cuando `3000` ya esta en uso.
- constraints:
  - No matar procesos ajenos para liberar `3000`.
  - Mantener el comportamiento actual de arranque estable y watch.
- current_status: completed
- scope: safe
