# Dirección recomendada de migración

Fecha: 2026-03-28

## Decisión resumida
La mejor forma de continuar la migración hacia una estructura sólida para lanzar no es hacer un refactor horizontal completo. El camino correcto es:

1. terminar de formalizar acceso y permisos
2. estabilizar pagos, premium y admin
3. introducir repositorios sólo en dominios críticos
4. postergar la normalización completa del modelo de datos para después del lanzamiento

## 1. ¿Tenemos repositorios?

Respuesta corta: no.

Estado real del código:
- hay helpers de dominio en `lib/*`
- hay una capa inicial de auth en `lib/server/auth/*`
- no existe una capa formal de `repositories`
- no existe una capa formal de `use-cases`
- muchos route handlers siguen consultando Supabase directamente

Conclusión:
- no conviene crear “repositorios para todo” ahora
- sí conviene crear repositorios sólo para dominios críticos y de alto riesgo

Repositorios mínimos recomendados antes de lanzar:
- `authRepository`
- `paymentsRepository`
- `authorApplicationsRepository`
- `withdrawalsRepository`
- `moderationRepository`

## 2. ¿Tenemos un modelo de datos avanzado?

Respuesta corta: como diseño objetivo sí, como implementación real no.

Estado real:
- el diseño objetivo quedó documentado en `docs/sql-target-schema.md`
- el schema real visible en `supabase/setup.sql` es incompleto
- el producto actual depende demasiado de `notifications`
- varias entidades operativas siguen serializadas en `message`

Conclusión:
- el modelo actual sirve para operar MVP
- todavía no es un modelo de datos avanzado ni robusto para escalar operación
- no conviene reescribirlo completo antes del lanzamiento

## 3. ¿Todos los endpoints están validados?

Respuesta corta: no.

Lo que sí está mejor:
- auth backend centralizada en `lib/server/auth/session.ts`
- `AuthGate` ya no falla abierto
- `posts/create` ya exige autor aprobado
- `withdrawals/request` ya exige autor aprobado

Lo que sigue faltando o es débil:
- los endpoints admin siguen dependiendo de `isAdminUser()` por email/username en env
- no hay permisos persistidos todavía
- no hay `requirePermission(...)`
- no hay validación fuerte de webhook de Mercado Pago
- no hay capa uniforme de ownership para todos los recursos
- no hay rate limiting ni auditoría formal

Conclusión:
- los endpoints no están “sin validar”, pero tampoco están validados con una estructura final de lanzamiento
- hoy están en un estado intermedio razonable, no definitivo

## 4. Mejor estrategia para seguir

## 4.1 Qué NO haría ahora
- no normalizaría ya toda `notifications`
- no partiría el admin a otra app
- no construiría repositorios genéricos para cada tabla
- no metería middleware fuerte mientras la sesión siga en `localStorage`

Eso agregaría mucho movimiento con poco beneficio inmediato para launch.

## 4.2 Qué sí haría ahora

### Paso 1
Consolidar acceso:
- migración SQL de `roles`, `permissions`, `role_permissions`, `user_roles`
- migrar admin desde env a rol persistido
- introducir `hasRole` / `hasPermission`

### Paso 2
Endurecer endpoints críticos:
- admin
- pagos
- premium media
- retiros
- author applications
- account delete
- webhook

### Paso 3
Crear repositorios sólo para alto riesgo:
- pagos
- moderación
- retiros
- autores

### Paso 4
Agregar auditoría:
- cambios admin
- cambios de comisión
- acciones de moderación
- cambios de retiros

## 5. Orden recomendado para launch

### Bloque A: acceso
- roles/permisos
- reemplazo de `isAdminUser`
- validación homogénea de endpoints sensibles

### Bloque B: operación crítica
- webhook y pagos
- access premium
- buckets/storage
- envs reales

### Bloque C: orden de código
- repositorios mínimos
- casos de uso admin/pagos/retiros

### Bloque D: post-launch
- normalización de `notifications`
- modelo de datos administrativo dedicado
- refactor grande de admin

## 6. Decisión final
La mejor forma de seguir no es “hacer arquitectura perfecta” antes de lanzar. La mejor forma es:

- formalizar permisos en BD ahora
- endurecer endpoints ahora
- crear sólo la capa de repositorios necesaria
- dejar la reestructuración completa del modelo de datos para después del lanzamiento

Esa estrategia reduce riesgo real sin frenar el producto.
