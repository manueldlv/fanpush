# Request

- title: Expandir la base de RTK Query a sesion, busqueda, notificaciones y commerce
- requester: matias
- functional_goal: Reemplazar cargas y mutaciones cliente dispersas por APIs de RTK Query para reutilizar cache, evitar estados vacios al navegar y dejar una base lista para migrar feed, saldo y checkout.
- constraints:
  - Debe convivir con slices existentes mientras siga habiendo pantallas legacy.
  - Debe eliminar polling global innecesario y pasar a invalidaciones dirigidas.
  - Debe mantener compatibilidad con auth, notificaciones y Mercado Pago.
- current_status: completed
- scope: needs_approval
