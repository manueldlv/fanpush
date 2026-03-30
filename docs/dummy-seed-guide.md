# Dummy Seed Guide

## Objetivo
Seed manual para poblar FanPush con datos dummy de prueba y luego borrarlos antes del lanzamiento.

El script crea:
- usuarios reales en `auth.users` para `admin`, `author` y `buyer`
- perfiles, roles, metadata visible, payout profile y preferencias
- follows, likes, álbumes, posts, compra, propina, donation dummy en ledger
- solicitud de autor, retiro, reportes, moderación
- hilos y mensajes del centro de notificaciones e inbox admin

## Requisitos
- tener configurado `SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL`
- tener configurado `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY`
- acceso de red desde la máquina donde corres el script

El script lee variables desde:
- `.env.local`
- `.env`

## Comandos

### Rehacer todo el seed dummy
Limpia el seed anterior y vuelve a crearlo.

```bash
npm run seed:dummy
```

Equivalente:

```bash
node scripts/seed-dummy-data.mjs reseed
```

O por shell:

```bash
bash scripts/seed-dummy-data.sh reseed
```

### Crear seed sin limpiar antes
Úsalo solo si no existe un seed dummy previo cargado.

```bash
npm run seed:dummy:seed
```

Equivalente:

```bash
node scripts/seed-dummy-data.mjs seed
```

### Borrar el seed dummy
Elimina los usuarios dummy y sus datos asociados.

```bash
npm run seed:dummy:clean
```

Equivalente:

```bash
node scripts/seed-dummy-data.mjs clean
```

## Credenciales dummy
- `seed-admin@fanpush.test` / `FanpushDemo123!`
- `seed-author@fanpush.test` / `FanpushDemo123!`
- `seed-buyer@fanpush.test` / `FanpushDemo123!`

## Archivos
- [scripts/seed-dummy-data.mjs](/Users/devforce/Documents/GitHub/fanpush/scripts/seed-dummy-data.mjs)
- [scripts/seed-dummy-data.sh](/Users/devforce/Documents/GitHub/fanpush/scripts/seed-dummy-data.sh)

## Nota operativa
- `seed:dummy` es el comando recomendado para pruebas repetibles.
- `seed:dummy:clean` conviene correrlo antes de dejar la base lista para lanzamiento.
- La `donation` se carga como dummy de ledger para cubrir ese tipo de interacción aunque hoy no haya UI pública dedicada.
