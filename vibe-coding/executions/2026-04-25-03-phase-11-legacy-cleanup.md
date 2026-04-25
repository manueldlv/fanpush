# 2026-04-25-03 Phase 11 Legacy Cleanup

## Status

- phase: `11`
- state: `in_progress`
- last_safe_resume_point: `decide-final-removal-of-legacy-files-and-fallback-readers`

## Changes

- `settingsApi` dejó de escribir `profile_meta`, `payout_profile` y `notification_preferences` en `notifications`.
- `profileApi` ahora prioriza `user_meta` para `profile.details` y usa `notifications` solo como fallback.
- `notificationsSlice` ahora prioriza `user_meta` para `notification.preferences`.
- `settings`, `viewer` y perfil ya no dependen de `notifications` como fuente principal de configuración privada.

## Validation

- `npm run build`
- Resultado: OK

## Pending

- decidir si se eliminan físicamente `viewerSlice` y otros helpers legacy ya desactivados
- decidir cuándo retirar fallback readers restantes sobre `notifications` para datos antiguos
