# Execution

- id: 2026-03-30-03-login-demo-buttons
- plan_id: none
- executed_by: matias
- scope: safe
- files_changed:
  - app/auth/page.tsx
- what_changed:
  - Se agrego una lista local de cuentas demo.
  - Se sumo un bloque "Accesos demo" visible solo en modo login.
  - Cada boton carga email y contraseña en el formulario y limpia mensajes previos.
- validation:
  - `npm run build` completo correctamente.
- matched_plan: yes
