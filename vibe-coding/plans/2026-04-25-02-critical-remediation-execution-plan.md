# Plan

- id: 2026-04-25-02-critical-remediation-execution-plan
- title: Plan de ejecucion para remediar hallazgos criticos sin romper contratos ni reglas activas
- type: plan
- scope: needs_approval
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- based_on:
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-01-architecture-and-entities.md
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-02-client-state-and-fetching.md
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-03-api-security-and-authz.md
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-04-persistence-and-db-impact.md
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-05-business-rules-consistency.md
  - vibe-coding/plans/2026-04-25-01-critical-technical-audit-stage-06-critical-findings-summary.md
- files_allowed:
  - app/**
  - components/**
  - lib/**
  - services/**
  - supabase/**
  - scripts/**
  - vibe-coding/**
- files_blocked:
  - No cambiar reglas de negocio ambiguas sin confirmacion explicita
  - No eliminar compatibilidad legacy hasta verificar consumers
  - No cambiar payloads publicos de endpoints sin capa de compatibilidad
  - No ejecutar borrados destructivos de datos existentes

## Goal

Corregir los hallazgos `P0-P2` de la auditoria tecnica con una secuencia segura, reversible cuando sea posible, y diseñada para no romper comportamiento vigente salvo donde la regla actual sea ambigua o insegura.

## Execution Principles

- Preservar comportamiento visible mientras se fortalece la fuente de verdad.
- Preferir dual-write o dual-read temporal antes que cortes bruscos.
- Mover reglas hacia una fuente canonica antes de eliminar el camino legacy.
- Encapsular flujos criticos en casos de uso server-side antes de simplificar cliente.
- Cambiar primero seguridad y observabilidad, luego verdad financiera, luego sincronizacion de estado, luego cleanup estructural.

## Locked Business Decisions

Estas definiciones ya quedaron cerradas y deben tratarse como reglas de implementación:

1. `withdrawal_requests` es la entidad canónica del pedido de retiro.
   - representa el workflow operativo
   - el usuario sí pierde saldo disponible al crear el pedido
   - ese movimiento representa una reserva interna del saldo del usuario
   - no representa todavía un egreso real de plataforma

2. El payout real de plataforma ocurre solo cuando el retiro se paga efectivamente.
   - el balance global/plataforma no debe tratar el request como pago ejecutado
   - la contabilidad debe distinguir entre:
     - reserva interna de saldo del usuario
     - payout real al proveedor/exterior

3. La fuente canónica de datos de cobro será `payouts_meta`.
   - `withdrawal_requests` queda para solicitudes concretas
   - `payouts_meta` guarda configuración de cobro flexible mediante `meta_key/meta_value`
   - usar `meta_key` tipo `accounts.default`
   - no debe existir dependencia operativa en `notifications` para payout data
   - no hace falta precrear fila para usuarios no autores

4. La fuente canónica de admin será solo DB.
   - el estado final del sistema no debe depender de `ADMIN_EMAILS` o `ADMIN_USERNAMES`
   - puede existir transición temporal controlada, pero el objetivo final es solo roles persistidos

## Non-Negotiable Safety Rules

- Todo cambio financiero debe tener idempotencia verificable.
- Todo cambio de permisos debe mantener o endurecer el control, nunca relajarlo.
- Todo cambio que toque `notifications` como store legacy debe introducir compatibilidad temporal.
- Todo refactor de estado cliente debe mantener la misma semantica de negocio aunque cambie la infraestructura.
- Ninguna eliminación de fallback o store legacy se hace antes de auditar sus consumers reales.

## Tracks

### Track A: Security Hardening

Objetivo:
cerrar la superficie de riesgo inmediato sin cambiar reglas de producto.

Incluye:

1. Fortalecer `app/api/mercadopago/webhook/route.ts`.
   - validar autenticidad del webhook antes de procesar
   - validar tipo de evento esperado
   - rechazar payloads incompletos o inesperados
   - registrar idempotencia y resultado por request

2. Aislar la autorización admin.
   - introducir una función canónica para resolver acceso admin
   - agregar transición controlada para remover fallback legacy
   - dejar roles persistidos como única verdad final
   - agregar trazas hasta retirar el fallback por completo

3. Endurecer `app/api/media/access/route.ts`.
   - validar alcance máximo de recursos consultables
   - limitar resolución a posts efectivamente consumidos por el flujo
   - evitar que funcione como enumerador arbitrario

4. Revisar operaciones destructivas.
   - instrumentar `account/delete`
   - separar preparación, persistencia y finalización
   - agregar marca de progreso o compensación explícita

Aceptación:

- el webhook ya no procesa eventos no autenticados
- la decisión de admin queda observable y centralizada
- `media/access` no acepta universos arbitrarios de contenido

### Track B: Financial Truth Model

Objetivo:
hacer que dinero, saldo, retiros, comisiones y earnings dependan de una fuente estructurada y consistente.

Incluye:

1. Unificar la verdad de earnings y tips.
   - dejar de usar `notifications.message` como fuente primaria de dinero
   - introducir lectura canonica desde ledger o tablas estructuradas equivalentes
   - mantener compatibilidad temporal de lectura mientras se migra

2. Alinear payout profile y eligibility de retiros.
   - mover `settings`, `/api/me` y `withdrawals/request` a `payouts_meta`
   - usar `meta_key = accounts.default` como contrato base
   - conservar compatibilidad temporal solo para lectura mientras se migra

3. Consolidar retiros sobre `withdrawal_requests` + ledger.
   - `withdrawal_requests` queda como workflow canónico
   - el movimiento al pedir retiro pasa a modelarse como reserva interna de saldo del usuario
   - el pago real se modela aparte como payout efectivamente ejecutado
   - mantener proyección legacy solo mientras existan consumers
   - dejar trazable y documentada la diferencia entre:
     - request operativo
     - reserva de saldo del usuario
     - payout real

4. Consolidar compras.
   - crear una frontera canónica de acreditación que cubra:
     `ledger`, `purchases`, `notifications` y acceso al contenido
   - hacer que pago interno y pago externo llamen el mismo caso de uso o dos casos muy delgados sobre un core único

5. Centralizar la regla de comisión.
   - mover normalizaciones legacy a una capa explícita de compatibilidad/migración
   - evitar correcciones silenciosas dispersas

Aceptación:

- el cálculo financiero visible no depende de texto libre
- payout profile se resuelve igual en settings, viewer y retiros
- compras internas y externas producen el mismo contrato de persistencia

### Track C: State and Data Contracts

Objetivo:
eliminar fuentes de verdad duplicadas y sincronización frágil del cliente sin cambiar el negocio.

Incluye:

1. Unificar `viewer`.
   - elegir una fuente canónica en cliente
   - mantener adaptadores transitorios para no romper pantallas

2. Reemplazar eventos `window` críticos por invalidaciones/updates contractuales.
   - balance
   - compras
   - earnings
   - profile summary

3. Encapsular lecturas cliente críticas detrás de endpoints o APIs canónicas.
   - ventas
   - retiros
   - follows en superficies secundarias
   - payout account

4. Reducir escrituras directas desde pantallas hacia tablas de negocio.
   - preferir mutations compartidas
   - documentar dónde Supabase directo sigue permitido

Aceptación:

- `viewer` no se hidrata por dos pipelines distintos
- la coherencia entre pantallas no depende de recordar emitir eventos manuales
- ventas/retiros no se reconstruyen desde cliente con lógica crítica distribuida

### Track D: Persistence Integrity

Objetivo:
evitar estados parciales y storage huérfano.

Incluye:

1. Publicación de contenido.
   - introducir rollback o estrategia de compensación explícita
   - limpiar uploads huérfanos en fallas
   - evitar álbum vacío persistido como éxito parcial

2. Chat adjuntos/premium.
   - registrar metadata provisional o cleanup al fallar la inserción final
   - asegurar trazabilidad entre objeto y mensaje

3. Archivado de cuenta.
   - reorganizar la secuencia para soportar recuperación o reintento seguro
   - introducir estado de proceso si hace falta

4. Retiros y compras.
   - donde no haya transacción cross-surface, introducir secuencia idempotente con reintentos seguros y marcadores de progreso

Aceptación:

- los flujos críticos no dejan datos huérfanos sin forma de reconciliación
- cada operación sensible tiene un estado recuperable o compensable

## Recommended Order

1. Track A.1 webhook de Mercado Pago
2. Track A.2 authz admin
3. Track B.2 payout profile canónico
4. Track B.3 retiros sobre fuente estructurada
5. Track B.1 earnings/tips estructurados
6. Track B.4 core canónico de compras
7. Track C.1 viewer canónico
8. Track C.2 eliminar sync crítica por window events
9. Track C.3 ventas/retiros server-driven
10. Track D.1 publicación de contenido
11. Track D.2 chat uploads
12. Track D.3 archivado de cuenta
13. Track B.5 cleanup final de comisión legacy
14. Cleanup controlado de stores legacy ya sin consumers

## Compatibility Strategy

- `Phase 1`: agregar mecanismos nuevos sin apagar los viejos
- `Phase 2`: mover consumers al camino canónico
- `Phase 3`: validar equivalencia funcional y telemetría
- `Phase 4`: retirar fallback legacy sólo cuando no queden lectores/escritores activos

## Remaining Decision Gates

Queda un único punto a definir durante implementación detallada, pero ya no bloquea el plan general:

1. Naming final de estados internos de retiro.
   No importa tanto la etiqueta final mientras:
   - la máquina de estados sea única
   - la semántica esté documentada en código
   - quede clara la diferencia entre reserva del usuario y payout real

## Execution Artifacts

Cada track o sub-track implementado debe dejar:

- plan hijo o ejecución asociada en `vibe-coding/executions/`
- lista de archivos tocados
- validaciones corridas
- riesgo residual
- rollback o compensación si aplica

## Acceptance Criteria

- El plan de remediación prioriza `P0/P1` sin romper contratos existentes.
- Cada track incluye estrategia de compatibilidad.
- Quedan identificados los puntos donde una decisión técnica depende de definición de negocio.
- El plan permite ejecutar por lotes pequeños y verificables.
