# 2026-04-25-03 Phase 07 Viewer Session

## Status

- phase: `07`
- state: `in_progress`
- last_safe_resume_point: `retire-remaining-active-viewer-slice-dependencies`

## Changes

- `FeedLayout` dejó de leer balance desde `state.viewer` y pasa a `useGetViewerQuery`.
- `PerfilPageClient` dejó de leer balance desde `state.viewer` y pasa a `useGetViewerQuery`.
- `AppStateBootstrap` ya no rehidrata activamente el `viewerSlice`; invalida `sessionApi` y `profileApi`.
- el reducer `viewer` salió del store de Redux en runtime; el slice quedó solo como referencia legacy temporal.

## Validation

- `npm run build`
- Resultado: OK

## Pending

- decidir si `viewerSlice` se elimina físicamente en cleanup final o se conserva solo como referencia temporal
