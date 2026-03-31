# Execution

- id: 2026-03-30-07-notifications-dropdown-footer-link
- plan_id: none
- executed_by: matias
- scope: safe
- files_changed:
  - components/TopBar.tsx
- what_changed:
  - Se agrego un enlace al pie del dropdown con el texto `Entrar al centro de notificaciones`.
  - El enlace navega a `/notificaciones` y cierra el dropdown.
- validation:
  - `npm run build` completo correctamente.
- matched_plan: yes
