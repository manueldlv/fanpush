# Execution

- id: 2026-03-30-05-script-permissions
- plan_id: none
- executed_by: matias
- scope: safe
- files_changed:
  - package.json
- non_file_actions:
  - `chmod +x scripts/run-local-stable.sh scripts/dev-safe.sh scripts/port-utils.sh`
- what_changed:
  - Los scripts de `package.json` ahora invocan `zsh` explicitamente.
  - Se restauraron permisos de ejecucion en los scripts locales.
- validation:
  - `npm run dev:watch -- --help`
  - El comando corrio sin `Permission denied` y mostro `Puerto 3000 ocupado. Usando 3001.`
- matched_plan: yes
