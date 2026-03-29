# Mapa de rutas y endpoints

## Objetivo
Inventario práctico de las rutas existentes en `app/`, separado entre:
- rutas web de producto
- rutas web admin
- endpoints API

Referencia de acceso según [AuthGate.tsx](/Users/devforce/Documents/GitHub/fanpush/components/AuthGate.tsx):
- públicas: `/auth`, `/admin/login`, `/checkout/return`, `/terminos`, `/privacidad`, `/ayuda`, `/faq`
- autenticadas: el resto

## 1. Rutas web de producto

### Públicas
- `/auth`: login, registro, recuperación y reset de contraseña.
- `/checkout/return`: retorno del checkout de Mercado Pago y reanudación de pago pendiente.
- `/terminos`: términos y condiciones.
- `/privacidad`: política de privacidad.
- `/ayuda`: página informativa de ayuda.
- `/faq`: preguntas frecuentes.

### Autenticadas
- `/`: feed principal.
- `/explorar`: exploración de contenido/usuarios.
- `/perfil`: perfil del usuario autenticado.
- `/user/[username]`: perfil público de un usuario por username.
- `/crear`: flujo de creación de contenido.
- `/compras`: biblioteca de contenido comprado.
- `/ventas`: ventas, ganancias y retiros del creador.
- `/settings`: configuración de perfil, pagos y notificaciones.
- `/autor/solicitud`: solicitud para convertirse en autor.

## 2. Rutas web admin
- `/admin/login`: login separado para el panel admin.
- `/admin`: dashboard principal de backoffice, moderación, retiros, autores, usuarios y métricas.

## 3. Endpoints API de producto

### Cuenta y perfil
- `POST /api/account/delete`: borrar la cuenta autenticada y su data asociada.

### Autor y contenido
- `POST /api/author/apply`: enviar o actualizar solicitud de autor.
- `POST /api/posts/create`: crear una publicación/álbum nuevo.
- `POST /api/media/access`: resolver acceso real a media premium comprada o propia.
- `POST /api/reports/content`: reportar contenido de otro usuario.

### Compras, pagos y retiros
- `POST /api/mercadopago/preference`: crear preferencia de pago para compra o propina.
- `POST /api/mercadopago/finalize`: acreditar un pago al usuario autenticado.
- `POST /api/mercadopago/webhook`: webhook de Mercado Pago para acreditación server-to-server.
- `POST /api/withdrawals/request`: solicitar retiro de ganancias.

## 4. Endpoints API admin

### Acceso y dashboard
- `GET /api/admin/access`: validar que la sesión tenga acceso admin.
- `GET /api/admin/dashboard`: devolver datasets agregados del panel admin.
- `POST /api/admin/dev/seed`: sembrar datos demo de desarrollo.

### Usuarios y roles
- `PATCH /api/admin/users/[id]`: cambiar perfil de comisión de un usuario.
- `GET /api/admin/users/[id]/roles`: ver roles activos de un usuario.
- `PATCH /api/admin/users/[id]/roles`: asignar o revocar `moderator`, `admin`, `super_admin`.

### Solicitudes de autor
- `PATCH /api/admin/authors/[id]`: aprobar o rechazar solicitud de autor.
- `DELETE /api/admin/authors/[id]`: archivar solicitud de autor.
- `POST /api/admin/authors/[id]`: restaurar solicitud archivada.

### Moderación de reportes y contenido
- `PATCH /api/admin/reports/[id]`: marcar reporte como revisado, descartado o removido.
- `DELETE /api/admin/reports/[id]`: archivar reporte ya procesado.
- `POST /api/admin/reports/[id]`: restaurar reporte archivado.
- `DELETE /api/admin/content/[albumId]`: eliminar contenido por moderación.
- `PATCH /api/admin/content/[albumId]`: aprobar o archivar revisión de contenido.
- `POST /api/admin/content/restore/[archiveId]`: restaurar contenido moderado desde historial.

### Operación financiera
- `PATCH /api/admin/withdrawals/[id]`: aprobar o rechazar retiros.

## 5. Archivos de soporte que no son rutas
- [layout.tsx](/Users/devforce/Documents/GitHub/fanpush/app/layout.tsx): shell global.
- [error.tsx](/Users/devforce/Documents/GitHub/fanpush/app/error.tsx): boundary de error.
- [PerfilPageClient.tsx](/Users/devforce/Documents/GitHub/fanpush/app/perfil/PerfilPageClient.tsx): implementación cliente del perfil autenticado.

## 6. Relación con otros documentos
- inventario de API con riesgo: [api-inventory.md](/Users/devforce/Documents/GitHub/fanpush/docs/api-inventory.md)
- matriz de permisos: [permission-matrix.md](/Users/devforce/Documents/GitHub/fanpush/docs/permission-matrix.md)
- guía SQL operativa: [sql-operations-guide.md](/Users/devforce/Documents/GitHub/fanpush/docs/sql-operations-guide.md)
