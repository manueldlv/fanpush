# Plan

- id: 2026-04-25-03-phase-02-admin-db-roles-detailed
- title: Fase 02 detallada - autorizacion admin solo por roles persistidos
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- parent_plan: vibe-coding/plans/2026-04-25-03-full-project-execution-roadmap.md

## Goal

Dejar una única fuente de verdad para admin: roles persistidos en DB.

## Why This Phase Exists

Hoy admin se resuelve mezclando roles reales con fallback por env. Eso complica auditoría, debugging, predicción de permisos y seguridad. La regla ya quedó definida: admin solo por DB.

## Primary Sources To Read

- auditoría `stage 01` y `stage 03`
- `lib/admin.ts`
- `lib/server/auth/roles.ts`
- `lib/server/auth/authorization.ts`
- `lib/server/session/**`
- `/api/me`
- `app/api/admin/**`
- componentes o hooks que condicionen UI admin

## Business Rules To Preserve

- un usuario admin debe seguir viendo lo mismo que hoy si ya tiene rol persistido
- un usuario no admin no debe ganar acceso por env fallback
- la UI no debe mostrar affordances admin si la API no los respalda

## What Will Change

- centralización de `isAdmin` / `hasAdminRole`
- migración de consumers a un helper único
- retiro de fallback por `ADMIN_EMAILS` / `ADMIN_USERNAMES`
- alineación entre UI, `/api/me` y rutas admin

## Search Plan

Buscar:

- todas las referencias a `ADMIN_EMAILS`, `ADMIN_USERNAMES`, `isAdminEmail`, `legacyAdmin`
- todos los lugares donde se derive admin desde profile/session/viewer
- diferencias entre autorización de UI y autorización real de endpoint

Cruzar:

- helper de auth -> respuesta `/api/me` -> guardas UI -> handlers admin

## Ambiguity Handling

Si aparece un flujo donde un usuario legacy depende de env para seguir operando:

- registrar el caso en la fase
- documentar el rol faltante y dónde debería persistirse
- no mantener el fallback final
- si hace falta transición, documentarla como migración explícita y acotada

## Validation Checklist

- [ ] no quedan checks admin por env en runtime final
- [ ] `/api/me` refleja solo roles persistidos
- [ ] la UI admin depende de la misma fuente canónica que la API
- [ ] los handlers admin rechazan correctamente usuarios sin rol

## Exit Criteria

- la autorización admin es auditable y única
- quedó eliminada la doble verdad de permisos

## Resume Instructions

Retomar desde el siguiente consumer no migrado del helper canónico de admin y volver a verificar que no haya referencias activas a env fallback.
