# Request

- title: Cachear la carga de perfiles con RTK Query
- requester: matias
- functional_goal: Evitar que la vista de perfil se vacie y rehaga toda la carga al volver a abrir un perfil ya visitado.
- constraints:
  - Debe usar RTK Query.
  - Debe conservar datos cacheados entre mounts normales.
  - Debe invalidar cuando el perfil cambie de verdad.
- current_status: completed
- scope: needs_approval
