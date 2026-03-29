# Auditoría de checklist de lanzamiento

Fecha de revisión: 2026-03-28

## Criterio de estado
- `Implementado`: existe flujo/código claro en el repo
- `Parcial`: existe parte del flujo, pero no está completo o tiene huecos
- `No encontrado`: no vi implementación real en el código
- `Pendiente de validación real`: existe código, pero sólo puede cerrarse probando deploy/producción

## Resumen ejecutivo
- El core de compras, propinas, desbloqueo premium, solicitudes de autor, retiros y moderación admin existe.
- La parte más débil sigue siendo producción real, auth/roles, y algunas features del checklist que no aparecen implementadas.
- Lo que claramente falta programar o no aparece en el código: links públicos de donación, propina por post separada de propina por perfil, referidos, badges, usuarios destacados, posts fijados y una política operativa formal dentro del producto.
- Lo que sí existe pero necesita prueba real urgente: compra E2E en producción, regreso de Mercado Pago con sesión, storage/buckets, contenido premium histórico, responsive completo y deploy/envs.

## 1. Pagos

### Compra de post de punta a punta en producción
- Estado: `Pendiente de validación real`
- Evidencia: creación de preferencia en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/mercadopago/preference/route.ts), acreditación en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/mercadopago/finalize/route.ts), retorno en [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/checkout/return/page.tsx)
- Observación: el flujo existe, pero no puedo certificarlo sin probar deploy y Mercado Pago real

### Propina por perfil
- Estado: `Implementado`
- Evidencia: checkout de propina desde perfil en [PerfilPageClient.tsx](/Users/devforce/Documents/GitHub/fanpush/app/perfil/PerfilPageClient.tsx#L655), soporte backend para `kind: "tip"` en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/mercadopago/preference/route.ts#L110)

### Propina por post
- Estado: `No encontrado`
- Evidencia: vi propina desde perfil, pero no flujo específico por post/album. No encontré payload ni UI que asocie tip a post concreto.

### Links públicos de donación
- Estado: `No encontrado`
- Evidencia: no encontré rutas, páginas ni componentes de donación pública.

### Vuelta de Mercado Pago sin perder sesión
- Estado: `Parcial`
- Evidencia: reintento de sesión y guardado de checkout pendiente en [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/checkout/return/page.tsx#L41) y [auth.ts](/Users/devforce/Documents/GitHub/fanpush/lib/auth.ts)
- Riesgo: el flujo existe, pero depende de timing/session recovery y debe validarse en producción

### Después de pagar se desbloquee el original y no quede blur
- Estado: `Parcial`
- Evidencia: acceso premium resuelto por signed URL del original en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/media/access/route.ts#L52)
- Riesgo: el backend está, pero hay que probar posts reales viejos y nuevos para confirmar que no queda preview/blur residual

## 2. Contenido premium

### Fotos y videos pagos usen original privado + preview pública
- Estado: `Implementado`
- Evidencia: paths público/privado en [media.ts](/Users/devforce/Documents/GitHub/fanpush/lib/media.ts), creación en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/posts/create/route.ts)

### Probar posts viejos y nuevos
- Estado: `Pendiente de validación real`
- Observación: necesario por riesgo de contenido legacy no migrado al esquema `locked-previews` / `premium`

### Confirmar que desde Mis compras todo abra bien
- Estado: `Parcial`
- Evidencia: resolución de media comprada en [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/compras/page.tsx#L36)
- Riesgo: existe el flujo, pero no está certificado sobre data real

### Miniaturas de video y reproducción real
- Estado: `Parcial`
- Evidencia: hay distinción image/video, pero no vi una capa explícita de generación de thumbnails para video
- Riesgo: puede reproducir, pero no veo garantía de thumbnail consistente

## 3. Producción

### Revisar `.env` de Vercel/Supabase/Mercado Pago
- Estado: `Pendiente externa`
- Evidencia: el código usa `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`
- Observación: no tengo acceso a Vercel/envs desde este entorno

### Confirmar dominio final en `NEXT_PUBLIC_SITE_URL`
- Estado: `Pendiente externa`
- Evidencia: base URL se resuelve en [mercadopago.ts](/Users/devforce/Documents/GitHub/fanpush/lib/mercadopago.ts#L168)

### Probar todo en deploy real, no solo en local
- Estado: `Pendiente`
- Observación: imprescindible

### Verificar buckets y permisos de storage
- Estado: `Parcial`
- Evidencia: buckets `Imagenes` y `premium` en [media.ts](/Users/devforce/Documents/GitHub/fanpush/lib/media.ts#L1), creación defensiva en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/posts/create/route.ts#L22)
- Riesgo: falta validar permisos reales en Supabase Storage y RLS

## 4. Usuario

### Registro, login y recuperación
- Estado: `Implementado`
- Evidencia: [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/auth/page.tsx)
- Riesgo: auth sigue arquitectónicamente débil; funcionalmente existe

### Flujo de Convertirme en autor
- Estado: `Implementado`
- Evidencia: UI en [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/autor/solicitud/page.tsx), API en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/author/apply/route.ts)

### Aprobación y rechazo con notificaciones
- Estado: `Implementado`
- Evidencia: [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/authors/[id]/route.ts)

### Compra, propina, ventas, retiros
- Estado: `Implementado`
- Evidencia: compras [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/compras/page.tsx), ventas/retiros [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/ventas/page.tsx)

### Donaciones
- Estado: `No encontrado`
- Observación: fuera de propina por perfil, no veo módulo de donaciones públicas

### Referidos
- Estado: `No encontrado`
- Observación: no encontré código ni tablas relacionadas

### Mobile en feed, perfil, crear, compras, ventas
- Estado: `Parcial`
- Evidencia: hay clases responsive en muchas pantallas, pero no puedo certificar comportamiento final sin prueba real

### Mobile en donaciones
- Estado: `No encontrado`
- Observación: porque no veo la feature implementada

## 5. Admin

### Moderación completa: aprobar, eliminar, restaurar, archivar
- Estado: `Implementado`
- Evidencia: reportes [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/reports/[id]/route.ts), contenido [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/content/[albumId]/route.ts), restauración [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/content/restore/[archiveId]/route.ts)

### Solicitudes de autor
- Estado: `Implementado`
- Evidencia: [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/authors/[id]/route.ts)

### Reportes y denuncias
- Estado: `Implementado`
- Evidencia: creación de denuncia en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/reports/content/route.ts), revisión admin en [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/reports/[id]/route.ts)

### Usuarios: comisión
- Estado: `Implementado`
- Evidencia: [route.ts](/Users/devforce/Documents/GitHub/fanpush/app/api/admin/users/[id]/route.ts)

### Usuarios: badges
- Estado: `No encontrado`
- Observación: no vi modelo ni UI real de badges

### Usuarios: estado de cuenta
- Estado: `Parcial`
- Evidencia: hay ventas, earnings y retiros; no vi un “estado de cuenta” formal como extracto operativo/financiero completo

### Inicio y visibilidad: usuarios destacados
- Estado: `No encontrado`
- Observación: sólo encontré texto mock en `NotificationsPanel`, no feature real

### Inicio y visibilidad: posts fijados
- Estado: `No encontrado`

## 6. Legal

### Términos y condiciones
- Estado: `Implementado`
- Evidencia: [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/terminos/page.tsx)
- Riesgo: el texto actual se declara “genérico”, no final legal cerrado

### Política de privacidad
- Estado: `Implementado`
- Evidencia: [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/privacidad/page.tsx)

### Texto +18
- Estado: `Parcial`
- Evidencia: términos exigen 18+ en [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/terminos/page.tsx#L35)
- Observación: no vi banner/aviso +18 claro y persistente como pieza de UX/legal separada

### Copies de moderación y contenido adulto
- Estado: `Parcial`
- Observación: hay copies básicos de moderación, pero no vi política explícita de contenido adulto dentro del producto

## 7. Operación

### Definir retiro real: frecuencia, método, tiempos
- Estado: `Parcial`
- Evidencia: FAQ y ayuda mencionan lote mensual/manual en [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/faq/page.tsx) y [page.tsx](/Users/devforce/Documents/GitHub/fanpush/app/ayuda/page.tsx)
- Observación: veo copy, no política operativa cerrada

### Definir política de moderación
- Estado: `Parcial`
- Observación: existe mecánica de moderación, pero no documento/política operativa completa dentro del repo

### Definir plan de soporte al usuario
- Estado: `No encontrado`

### Definir programa inicial para fundadores/aliados/embajadores
- Estado: `No encontrado`

## 8. Calidad

### Pasada completa de bugs visuales
- Estado: `Pendiente`

### Errores de scroll
- Estado: `Pendiente`

### Estados vacíos
- Estado: `Parcial`
- Observación: vi algunos, pero no una cobertura sistemática

### Mensajes de éxito/error
- Estado: `Parcial`
- Evidencia: existen muchos mensajes, pero hay mezcla de `alert`, textos genéricos y mensajes técnicos

### Que no queden textos técnicos visibles
- Estado: `No cumple del todo`
- Evidencia:
  - mensaje explícito de RLS en [FeedLayout.tsx](/Users/devforce/Documents/GitHub/fanpush/components/FeedLayout.tsx#L553)
  - mensaje similar en [PerfilPageClient.tsx](/Users/devforce/Documents/GitHub/fanpush/app/perfil/PerfilPageClient.tsx#L780)
  - textos de config faltante tipo Supabase en varias pantallas

## Faltantes sin programar o no encontrados

### Claramente faltantes
- propina por post
- links públicos de donación
- referidos
- badges de usuario
- usuarios destacados
- posts fijados
- plan de soporte al usuario
- programa fundadores/aliados/embajadores
- aviso +18 como pieza separada/final

### Parcialmente resueltos pero no cerrados
- regreso de Mercado Pago sin perder sesión
- desbloqueo premium en todos los casos legacy
- miniaturas reales de video
- estado de cuenta de usuario
- política de moderación
- política operativa de retiros
- responsive/mobile validado
- limpieza de mensajes técnicos visibles

## Riesgos prioritarios antes de lanzar

### Alta prioridad
- probar compra/propina E2E en producción
- validar envs reales de Vercel/Supabase/Mercado Pago
- validar storage y permisos de buckets
- probar desbloqueo premium con contenido real viejo y nuevo
- cerrar textos técnicos visibles

### Media prioridad
- formalizar legal/copies +18
- revisar responsive completo
- limpiar UX de mensajes vacíos/error/success

### Funcionalidad que falta si se quiere cumplir el checklist completo
- donaciones públicas
- tip por post
- referidos
- badges
- destacados
- fijados

## Recomendación final
El producto no está “vacío”: hay bastante implementado. Pero contra este checklist de lanzamiento todavía no lo daría por cerrado. Lo dividiría así:

### Se puede validar ya
- pagos base
- premium base
- autor
- admin
- legal base

### Se debe cerrar antes de producción
- pruebas E2E reales
- envs/dominio/storage
- auth/retorno de sesión
- limpieza UX/mensajes

### Requiere desarrollo nuevo
- donaciones públicas
- tip por post
- referidos
- badges
- destacados
- posts fijados
