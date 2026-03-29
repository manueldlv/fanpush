# User Meta Implementation

## Qué se agregó

Se incorporó `public.user_meta` como tabla genérica de metadata por usuario:

- `user_id`
- `meta_key`
- `meta_value` (`jsonb`)

Migración:
- [20260329000004_user_meta.sql](/Users/devforce/Documents/GitHub/fanpush/supabase/migrations/20260329000004_user_meta.sql)

Helpers:
- [userMeta.ts](/Users/devforce/Documents/GitHub/fanpush/lib/userMeta.ts)

## Meta keys iniciales

- `profile.details`
- `payout.profile`
- `account.state`
- `notification.preferences`

## Criterio

`user_meta` pasa a ser la fuente nueva para metadata de usuario que hoy no merece columna propia o todavía no tiene tabla dedicada.

Por compatibilidad, durante esta etapa se puede seguir leyendo o escribiendo fallback en `notifications` donde todavía existan lectores legacy.
