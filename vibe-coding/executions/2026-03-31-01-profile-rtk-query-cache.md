# Execution

- id: 2026-03-31-01-profile-rtk-query-cache
- plan_id: none
- executed_by: matias
- scope: needs_approval
- files_changed:
  - lib/redux/api/profileApi.ts
  - lib/redux/store.ts
  - app/perfil/PerfilPageClient.tsx
  - app/settings/page.tsx
- what_changed:
  - Se creo un API slice de RTK Query para cargar el bundle del perfil, posts, stats, follow y earnings cacheado por usuario.
  - La pagina de perfil paso a leer esos datos desde RTK Query en lugar de reconstruirse con `useEffect` y estado local transitorio.
  - Las mutaciones locales del perfil actualizan o invalidan el cache para no perder consistencia al seguir, borrar, comprar o editar el perfil.
- validation:
  - `npm run build` completo correctamente.
- matched_plan: yes
