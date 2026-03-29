# Tablero de acción de lanzamiento

Fecha: 2026-03-28

## Cómo leerlo
- `Cerrar probando`: el código existe, pero falta validarlo en entorno real
- `Cerrar corrigiendo`: hay implementación, pero necesita ajustes antes de lanzamiento
- `Falta desarrollar`: no encontré feature real en el código

## 1. Cerrar probando

### Pagos y premium
- compra E2E real en producción con Mercado Pago
- propina por perfil en producción
- regreso de Mercado Pago sin perder sesión
- desbloqueo del original después del pago
- contenido premium desde `Mis compras`
- posts premium viejos vs nuevos
- videos premium: reproducción real y fallback visual

### Producción
- revisar variables en Vercel
- revisar variables en Supabase
- revisar variables en Mercado Pago
- confirmar `NEXT_PUBLIC_SITE_URL`
- probar deploy real completo
- verificar buckets `Imagenes` y `premium`
- verificar permisos/RLS/storage

### Usuario
- registro
- login
- recuperación de contraseña
- solicitud de autor
- aprobación de autor
- rechazo de autor
- compras
- ventas
- retiros

### Admin
- moderación aprobar
- moderación eliminar
- moderación restaurar
- moderación archivar
- reportes y denuncias
- solicitudes de autor
- comisión por usuario

### Responsive
- feed mobile
- perfil mobile
- crear mobile
- compras mobile
- ventas mobile

## 2. Cerrar corrigiendo

### Auth y sesión
- cerrar `AuthGate` fail-open
- reforzar sesión en retorno de Mercado Pago
- revisar dependencia de sesión cliente para guards

### Premium
- verificar que todo post pago tenga preview pública + original privado
- revisar compatibilidad de contenido legacy
- revisar si el blur/preview se limpia siempre tras compra

### UX y calidad
- limpiar mensajes técnicos visibles
- revisar `alert()` como patrón UX
- revisar estados vacíos
- revisar mensajes de éxito/error
- revisar scrolls problemáticos
- hacer pasada completa de bugs visuales

### Legal y copies
- reemplazar términos genéricos por versión final legal
- revisar política de privacidad final
- definir y mostrar copy +18 más claro
- revisar textos de moderación
- revisar textos sobre contenido adulto

### Operación
- formalizar política real de retiros
- formalizar política de moderación
- definir tiempos y método operativo de pagos manuales

### Admin / modelo
- badges no implementados en usuarios admin
- “estado de cuenta” no aparece como módulo formal
- el panel depende demasiado de `notifications`

## 3. Falta desarrollar

### Monetización
- propina por post
- links públicos de donación
- módulo de donaciones públicas

### Growth / negocio
- referidos
- programa de fundadores
- programa de aliados
- programa de embajadores

### Admin / visibilidad
- badges de usuario
- usuarios destacados
- posts fijados

### Soporte y operación
- plan de soporte al usuario dentro del producto/operación

## 4. Prioridad recomendada

### Prioridad 1
- compra y desbloqueo premium
- envs y deploy real
- storage/buckets

### Prioridad 2
- retorno de sesión Mercado Pago
- pruebas E2E completas
- calidad visual y mensajes

### Prioridad 3
- legal final
- responsive completo
- operación de retiros y moderación

### Prioridad 4
- features faltantes no bloqueantes para MVP, si realmente entran en scope

## 5. Criterio de salida para lanzar

### Mínimo aceptable
- compra y tip funcionan en producción
- contenido premium desbloquea bien
- autor y retiros funcionan
- admin puede moderar y revisar autores
- legal final publicado
- no hay mensajes técnicos visibles

### No bloquearía el lanzamiento inicial si no está
- referidos
- badges
- destacados
- posts fijados
- programa embajadores/fundadores

### Sí bloquearía el lanzamiento si falla
- compra
- propina por perfil
- retorno de Mercado Pago
- acceso premium
- buckets/storage
- auth básica
- moderación crítica
