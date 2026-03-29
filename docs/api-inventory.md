# Inventario de API y evaluación de riesgo

## Objetivo
Mapear todos los endpoints detectados, su propósito, nivel de sensibilidad y recomendaciones de protección.

## Endpoints

### `POST /api/account/delete`
- propósito: borrar cuenta del usuario autenticado
- sensibilidad: crítica
- riesgo: alto
- requisitos: sesión válida, ownership estricto, auditoría, rate limit
- observación: toca datos personales, contenido y auth user

### `POST /api/auth/register`
- propósito: crear cuenta y enviar email de confirmación por Mailtrap
- sensibilidad: alta
- riesgo: medio
- requisitos: validación de email, username, password y términos

### `POST /api/auth/register/resend`
- propósito: reenviar email de confirmación o acceso por Mailtrap
- sensibilidad: media
- riesgo: medio
- requisitos: validación de email, rate limit recomendado

### `POST /api/auth/password/recovery`
- propósito: generar link de recuperación y enviarlo por Mailtrap
- sensibilidad: alta
- riesgo: medio
- requisitos: validación de email, rate limit recomendado

### `GET /api/admin/access`
- propósito: validar acceso al panel admin
- sensibilidad: alta
- riesgo: medio
- requisitos: sesión válida, permiso `admin.access`

### `GET /api/admin/dashboard`
- propósito: dashboard agregado del backoffice
- sensibilidad: alta
- riesgo: alto
- requisitos: `admin.dashboard.read`
- observación: expone información transversal de usuarios, finanzas y moderación

### `POST /api/admin/dev/seed`
- propósito: generar datos demo
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: `dev.seed`, sólo entornos no productivos
- observación: no debería existir habilitado en producción

### `PATCH /api/admin/users/[id]`
- propósito: cambiar comisión por usuario
- sensibilidad: alta
- riesgo: alto
- requisitos: `commissions.manage`

### `PATCH /api/admin/authors/[id]`
- propósito: aprobar/rechazar solicitud de autor
- sensibilidad: alta
- riesgo: alto
- requisitos: `authors.review`

### `DELETE /api/admin/authors/[id]`
- propósito: archivar solicitud de autor
- sensibilidad: media
- riesgo: medio
- requisitos: `authors.review`

### `POST /api/admin/authors/[id]`
- propósito: restaurar solicitud archivada
- sensibilidad: media
- riesgo: medio
- requisitos: `authors.review`

### `PATCH /api/admin/withdrawals/[id]`
- propósito: revisar retiro
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: `withdrawals.review`, auditoría estricta

### `PATCH /api/admin/reports/[id]`
- propósito: revisar reporte
- sensibilidad: alta
- riesgo: medio
- requisitos: `content.moderate`

### `DELETE /api/admin/reports/[id]`
- propósito: archivar/cerrar reporte
- sensibilidad: media
- riesgo: medio
- requisitos: `content.moderate`

### `POST /api/admin/reports/[id]`
- propósito: restaurar reporte archivado
- sensibilidad: media
- riesgo: medio
- requisitos: `content.moderate`

### `DELETE /api/admin/content/[albumId]`
- propósito: eliminar contenido por moderación
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: `content.moderate`, auditoría, razón obligatoria

### `PATCH /api/admin/content/[albumId]`
- propósito: aprobar/archivar revisión de contenido
- sensibilidad: alta
- riesgo: alto
- requisitos: `content.moderate`

### `POST /api/admin/content/restore/[archiveId]`
- propósito: restaurar contenido moderado
- sensibilidad: crítica
- riesgo: alto
- requisitos: `content.moderate`, auditoría

### `POST /api/author/apply`
- propósito: crear o actualizar solicitud de autor
- sensibilidad: alta
- riesgo: alto
- requisitos: `authors.apply`, validación fuerte de datos/KYC

### `POST /api/media/access`
- propósito: resolver acceso a media premium
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: sesión válida, ownership/compra
- observación: endpoint de autorización de lectura real

### `POST /api/mercadopago/preference`
- propósito: crear preferencia de pago
- sensibilidad: alta
- riesgo: alto
- requisitos: sesión válida, checks de compra/tip

### `POST /api/mercadopago/finalize`
- propósito: acreditar pago al usuario correcto
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: sesión válida, ownership del pago, idempotencia

### `POST /api/mercadopago/webhook`
- propósito: webhook de Mercado Pago
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: validación de origen/firma si aplica, idempotencia

### `POST /api/posts/create`
- propósito: crear publicación
- sensibilidad: alta
- riesgo: alto
- requisitos: `content.create`, validación de autor, ownership de storage

### `POST /api/reports/content`
- propósito: reportar contenido
- sensibilidad: media
- riesgo: medio
- requisitos: `content.report`, no self-report

### `POST /api/withdrawals/request`
- propósito: crear solicitud de retiro
- sensibilidad: crítica
- riesgo: muy alto
- requisitos: `withdrawals.request`, payout profile, mínimo, regla mensual

## Agrupación por riesgo

### Riesgo muy alto
- `/api/account/delete`
- `/api/admin/dev/seed`
- `/api/admin/withdrawals/[id]`
- `/api/admin/content/[albumId]` DELETE
- `/api/admin/content/restore/[archiveId]`
- `/api/media/access`
- `/api/mercadopago/finalize`
- `/api/mercadopago/webhook`
- `/api/withdrawals/request`

### Riesgo alto
- `/api/admin/dashboard`
- `/api/admin/users/[id]`
- `/api/admin/authors/[id]`
- `/api/author/apply`
- `/api/mercadopago/preference`
- `/api/posts/create`

### Riesgo medio
- `/api/admin/access`
- `/api/admin/reports/[id]`
- `/api/reports/content`

## Recomendaciones transversales
- todos los endpoints sensibles deben migrar a `requireAuth/requirePermission`
- agregar auditoría estructurada
- agregar rate limit en acciones costosas o abusables
- separar helpers de auth de Mercado Pago
- definir idempotencia en pagos y webhooks
