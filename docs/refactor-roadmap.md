# Roadmap de refactor

## Objetivo
Ordenar el sistema sin rehacer todo de una vez. La prioridad es bajar riesgo operativo primero y limpiar arquitectura después.

## Fase 0: hardening inmediato
Duración estimada: 1-2 días

### Tareas
- cerrar `AuthGate` para que no falle abierto
- extraer auth helper desde `lib/mercadopago.ts`
- crear `lib/server/auth/session.ts`
- crear `requireAuth(request)`
- inventariar todas las rutas protegidas

### Resultado
- no más acceso “permitido por falta de configuración”
- auth backend centralizada

## Fase 1: autorización base
Duración estimada: 2-4 días

### Tareas
- crear `middleware.ts`
- clasificar rutas públicas/autenticadas/admin/author
- proteger `/crear` correctamente
- crear `requireAdminAccess`
- crear `requireOwnership`

### Resultado
- UX de rutas consistente
- backend y frontend alineados en acceso

## Fase 2: roles y permisos persistidos
Duración estimada: 3-5 días

### Tareas
- crear tablas `roles`, `permissions`, `role_permissions`, `user_roles`
- seed de roles/permisos
- migrar admins actuales desde `.env` a BD
- reemplazar `isAdminUser`

### Resultado
- admin deja de depender de email/username hardcodeados
- base para permisos finos

## Fase 3: ordenar bootstrap de usuario
Duración estimada: 2-3 días

### Tareas
- consolidar `ensureAppUser()`
- dejar trigger + backend como única vía
- eliminar upserts duplicados de pantallas

### Resultado
- menos inconsistencias en `users/profiles`

## Fase 4: refactor del módulo admin
Duración estimada: 5-8 días

### Tareas
- dividir `app/admin/page.tsx`
- extraer casos de uso admin
- mover fetches y lógica operativa a `lib/server/admin/*`

### Resultado
- panel mantenible
- menos acoplamiento

## Fase 5: normalización del modelo de datos
Duración estimada: 1-2 semanas

### Tareas
- crear tablas dedicadas para author applications
- crear tablas dedicadas para withdrawals
- crear tablas dedicadas para moderation/reports
- crear tabla dedicada para commission profiles
- dejar `notifications` para inbox

### Resultado
- queries más simples
- admin más confiable
- mejor trazabilidad

## Fase 6: seguridad y auditoría
Duración estimada: 3-5 días

### Tareas
- tabla de auditoría estructurada
- rate limiting
- endurecer webhook/pagos
- aislar `dev/seed` por entorno

### Resultado
- menor riesgo en operaciones críticas

## Orden recomendado si hay poco tiempo
1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 6
5. Fase 3
6. Fase 4
7. Fase 5

## Quick wins
- bloquear `/crear` a no autores
- sacar fail-open de `AuthGate`
- reemplazar admin por rol persistido
- mover auth fuera de `lib/mercadopago.ts`

## Riesgos de ejecución
- tocar datos y permisos a la vez puede romper el panel
- migrar `notifications` demasiado pronto puede bloquear admin
- conviene mantener compatibilidad temporal durante la migración

## Estrategia de migración recomendada
- primero introducir nueva infraestructura
- luego adaptar endpoints uno por uno
- después migrar frontend
- recién al final borrar compatibilidad vieja
