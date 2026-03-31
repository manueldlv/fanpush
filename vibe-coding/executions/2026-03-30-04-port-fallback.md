# Execution

- id: 2026-03-30-04-port-fallback
- plan_id: none
- executed_by: matias
- scope: safe
- files_changed:
  - scripts/port-utils.sh
  - scripts/run-local-stable.sh
  - scripts/dev-safe.sh
- what_changed:
  - Se agrego un helper para extraer el puerto pedido y encontrar el siguiente puerto libre.
  - `run-local-stable.sh` y `dev-safe.sh` dejaron de matar procesos en `3000-3005`.
  - Ambos scripts ahora reutilizan los argumentos originales y reemplazan solo el puerto cuando hace falta.
- validation:
  - Con `3000` ocupado, la resolucion devolvio `3001`.
  - `zsh -n scripts/port-utils.sh`
  - `zsh -n scripts/run-local-stable.sh`
  - `zsh -n scripts/dev-safe.sh`
- matched_plan: yes
