# Análisis exhaustivo del módulo admin

## 1. Estado actual del módulo

El admin existe dentro de la misma app Next.js:
- UI principal en `app/admin/page.tsx`
- login en `app/admin/login/page.tsx`
- endpoints en `app/api/admin/**`

Opera con:
- sesión Supabase del browser
- bearer token hacia API interna
- validación server-side mediante `getAuthenticatedUser()`
- autorización por `isAdminUser()`

## 2. Qué capacidades administra hoy

### 2.1 Dashboard
- usuarios
- contenido
- compras
- propinas
- retiros
- reportes
- solicitudes de autor
- historial de moderación
- comisiones por usuario

### 2.2 Moderación de contenido
- revisar reportes
- marcar contenido como revisado/aprobado
- archivar revisión
- eliminar contenido
- registrar acciones asociadas

### 2.3 Solicitudes de autor
- aprobar
- rechazar
- archivar
- restaurar archivado
- notificar al usuario

### 2.4 Retiros
- ver solicitudes
- marcar retiro enviado o rechazado
- generar historial
- notificar al usuario

### 2.5 Comisiones
- asignar `creatorShare`
- persistencia actual en `notifications`

### 2.6 Seed operativo
- endpoint para poblar datos demo

## 3. Arquitectura actual

### 3.1 Frontend
El archivo `app/admin/page.tsx` concentra demasiada responsabilidad:
- carga de dashboard
- tabs
- llamadas API
- manejo de errores
- estado de negocio
- render pesado de listas y detalles

Riesgos:
- acoplamiento alto
- difícil testear
- difícil mover a módulos
- cambios de negocio impactan UI y networking a la vez

### 3.2 Backend
Los route handlers admin hacen:
- auth
- autorización
- lectura y parsing de estados
- validación de transición
- escritura de cambios
- escritura de historial
- escritura de notificación

Eso indica falta de capa de caso de uso.

### 3.3 Datos
La mayoría del módulo admin depende de reconstruir estado desde `notifications`.

## 4. Qué está bien

### 4.1 Seguridad mínima backend
Los endpoints sensibles no se apoyan sólo en el frontend.

### 4.2 Bounded context reconocible
Aunque no esté formalizado, el dominio admin existe:
- trust & safety
- payouts
- creator onboarding
- commissions

### 4.3 Operación unificada
Desde negocio, tener un único panel hoy es útil.

## 5. Qué está mal

### 5.1 Admin no es un rol real
Se infiere por email/username configurado.

Problemas:
- sin trazabilidad
- sin delegación
- sin permisos finos
- sin baja/alta controlada por sistema

### 5.2 `notifications` como motor administrativo
El panel depende de parsear strings serializados en `message`.

Consecuencias:
- reporting frágil
- cambios de schema silenciosos
- índices poco específicos
- estados difíciles de consultar
- difícil garantizar integridad

### 5.3 UI sobredimensionada
`app/admin/page.tsx` debería partirse por dominios:
- dashboard
- users
- authors
- withdrawals
- reports
- content moderation

### 5.4 Sin separación de roles internos
Todo admin puede todo.

Eso no escala cuando aparezcan:
- soporte
- moderación
- finanzas
- operaciones

## 6. ¿Conviene dejarlo en el mismo lugar?

## 6.1 Respuesta corta
Sí, por ahora conviene mantenerlo en la misma app/repositorio.

## 6.2 Razones a favor de mantenerlo
- comparte tipos y dominio
- evita duplicar infraestructura
- simplifica despliegue
- mantiene velocidad de desarrollo
- el volumen aún parece de producto en etapa temprana

## 6.3 Razones para separarlo más adelante
- seguridad reforzada
- equipos distintos para panel y producto
- crecimiento del panel como sistema propio
- auditoría/regulación
- posibilidad de despliegues independientes

## 6.4 Conclusión pragmática
No separaría el admin a otro repo ni otra app todavía.

Sí haría separación lógica interna:
- capa de acceso
- capa de repositorios
- capa de casos de uso
- UI particionada

## 7. Diseño recomendado dentro del mismo proyecto

### 7.1 Estructura sugerida
- `app/(admin)/admin/page.tsx`
- `app/(admin)/admin/users/page.tsx`
- `app/(admin)/admin/reports/page.tsx`
- `app/(admin)/admin/withdrawals/page.tsx`
- `app/(admin)/admin/authors/page.tsx`

### 7.2 Backend sugerido
- `lib/server/admin/repositories/*`
- `lib/server/admin/use-cases/*`
- `lib/server/admin/policies/*`

### 7.3 Casos de uso sugeridos
- `getAdminDashboard()`
- `reviewContentReport()`
- `removeAlbumByModeration()`
- `approveAuthorApplication()`
- `rejectAuthorApplication()`
- `archiveAuthorApplication()`
- `reviewWithdrawal()`
- `updateUserCommission()`

## 8. Permisos recomendados dentro del admin

### 8.1 Roles internos
- `moderator`
- `finance_admin`
- `creator_admin`
- `ops_admin`
- `super_admin`

### 8.2 Permisos
- `admin.dashboard.read`
- `reports.review`
- `content.moderate`
- `authors.review`
- `withdrawals.review`
- `commissions.manage`
- `admin.seed`
- `roles.manage`

## 9. Evaluación por submódulo

### 9.1 Dashboard
Hoy mezcla:
- KPIs
- listas recientes
- datasets operativos

Mejor separar:
- métricas agregadas
- listas operativas
- drill-down por dominio

### 9.2 Moderación de contenido
Hoy:
- reportes y acciones viven en `notifications`
- el contenido moderado se archiva también ahí

Debería pasar a:
- `content_reports`
- `moderation_actions`
- `moderation_archives`

### 9.3 Autores
Hoy:
- solicitud principal
- historial
- archivado
- notificación
todo atravesado por `notifications`

Debería pasar a tablas dedicadas.

### 9.4 Retiros
Hoy el estado y el historial están serializados.

Esto es especialmente delicado porque toca dinero. Debe tener tablas propias.

### 9.5 Comisiones
El perfil de comisión por usuario también debería salir de `notifications` y pasar a tabla propia.

## 10. Seguridad del panel

### 10.1 Riesgos actuales
- permisos gruesos
- lógica sensible repartida
- sin auditoría estructurada
- un endpoint `dev/seed` en área sensible

### 10.2 Recomendaciones
- requerir permiso explícito para cada endpoint
- auditar actor, acción, recurso y metadata
- aislar endpoints dev/seed por entorno
- evitar que el frontend decida estados de negocio

## 11. Roadmap recomendado del módulo admin

### Etapa 1
- permisos persistidos
- helpers `requireAdminPermission`
- dividir UI en módulos

### Etapa 2
- mover estado administrativo a tablas propias
- extraer casos de uso

### Etapa 3
- auditoría estructurada
- filtros, reportes y métricas más confiables

### Etapa 4
- evaluar separación física si el panel ya opera como sistema independiente

## 12. Decisión final
Mantener el admin en la misma app es correcto hoy. Lo incorrecto es su nivel actual de acoplamiento y el uso de `notifications` como base de datos administrativa. La prioridad es reordenarlo, no mudarlo.
