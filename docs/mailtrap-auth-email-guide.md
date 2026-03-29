# Mailtrap Auth Email Guide

## Objetivo
FanPush ahora envía emails de autenticación sensibles desde backend usando Mailtrap API para:
- confirmación de cuenta
- recuperación de contraseña

## Variables esperadas
- `MAILTRAP_API_URL`
- `MAILTRAP_ACCESS_TOKEN`
- `MAILTRAP_SENDER_EMAIL` opcional
- `MAILTRAP_SENDER_NAME` opcional

Si `MAILTRAP_API_URL` no está definida, el código usa `https://send.api.mailtrap.io/api/send`.

## Flujo actual
- registro: `POST /api/auth/register`
  genera link de signup con `supabase.auth.admin.generateLink({ type: 'signup' })`
  y lo envía por Mailtrap
- recuperación: `POST /api/auth/password/recovery`
  genera link de recovery con `supabase.auth.admin.generateLink({ type: 'recovery' })`
  y lo envía por Mailtrap

El login normal sigue usando Supabase Auth desde frontend.

## Archivos principales
- [mailtrap.ts](/Users/devforce/Documents/GitHub/fanpush/lib/server/mailtrap.ts)
- [emails.ts](/Users/devforce/Documents/GitHub/fanpush/lib/server/auth/emails.ts)
- [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/auth/register/route.ts)
- [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/auth/password/recovery/route.ts)
- [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/auth/page.tsx)

## Requisitos operativos
- el dominio/sender usado en `MAILTRAP_SENDER_EMAIL` debe estar habilitado en Mailtrap
- no exponer nunca `MAILTRAP_ACCESS_TOKEN` en frontend
- `NEXT_PUBLIC_SITE_URL` debe apuntar al dominio correcto para que los links redirijan bien

## Limitaciones actuales
- el reenvío de confirmación no tiene interfaz propia todavía
- si quieres centralizar todos los emails de Auth en Supabase, el siguiente paso sería evaluar `Send Email Hook`
