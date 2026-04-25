# Audit Stage Report

## Metadata

- `plan_id`: `2026-04-25-01-critical-technical-audit`
- `stage_id`: `stage-06`
- `title`: `Resumen consolidado de hallazgos críticos`
- `status`: `completed`
- `owner`: `vibe-agent`
- `date`: `2026-04-25`
- `domains_covered`: `auth`, `authz`, `payments`, `ledger`, `withdrawals`, `settings`, `notifications`, `direct-chats`, `content publishing`

## Objective

Consolidar los hallazgos `P0-P2` y dejar una base priorizada para un futuro plan de ejecución.

## Critical Findings

### P0

- `SEC-P0-01`
  `Webhook de Mercado Pago sin verificación de autenticidad`
  Impacto: acreditación de pagos es una frontera expuesta sin validación del proveedor.

### P1

- `STATE-P1-01`
  `Viewer/session duplicado entre RTK Query y slice manual`
  Impacto: permisos, balance y estado del usuario pueden divergir según la superficie.

- `STATE-P1-02`
  `Sincronización crítica basada en window events`
  Impacto: balance, compras y earnings pueden quedar obsoletos si falta un evento manual.

- `STATE-P1-03`
  `Settings con doble persistencia en user_meta y notifications`
  Impacto: payout/profile/preferences pueden verse distintos según la ruta.

- `STATE-P1-04`
  `Ventas/withdrawals calculadas desde cliente con parsing de notifications`
  Impacto: reporting y disponibilidad de retiro pueden no reflejar el backend real.

- `SEC-P1-02`
  `Media access resuelve recursos arbitrarios con admin`
  Impacto: expansión del alcance consultable y de enumeración de contenido.

- `SEC-P1-03`
  `Authz admin con fallback legacy además de roles persistidos`
  Impacto: fuente de verdad ambigua para permisos sensibles.

- `SEC-P1-04`
  `Archivado de cuenta multi-step sin atomicidad`
  Impacto: cuenta y relaciones pueden quedar parcialmente archivadas.

- `PERSIST-P1-01`
  `Publicación de contenido con álbum/uploads/posts sin rollback`
  Impacto: álbumes vacíos y objetos huérfanos.

- `PERSIST-P1-02`
  `Solicitud de retiro reserva dinero antes de completar persistencia legacy asociada`
  Impacto: balance reservado con registros secundarios incompletos.

- `PERSIST-P1-03`
  `Adjuntos de chat subidos antes de confirmar mensaje`
  Impacto: storage huérfano y trazabilidad rota.

- `PERSIST-P1-04`
  `Compras internas/externas sin una sola frontera atómica visible`
  Impacto: acceso y ledger pueden no moverse de forma indivisible.

- `RULES-P1-01`
  `Taxonomías de estados de retiro divergentes`
  Impacto: pérdida de información y lógica distinta por capa.

- `RULES-P1-02`
  `Earnings y tips derivados desde texto libre`
  Impacto: dinero dependiente de copy en notifications.

- `RULES-P1-03`
  `Corrección silenciosa de comisión legacy repartida en lectores`
  Impacto: comisión efectiva no está centralizada en el dato.

### P2

- `ARCH-P2-01`
  `Autenticación con side effects persistentes de bootstrap`

- `ARCH-P2-02`
  `Permisos con mezcla de roles persistidos y lógica legacy`

- `ARCH-P2-03`
  `Compras sin camino canónico único entre checkout interno y externo`

- `ARCH-P2-04`
  `Baseline financiero legacy cargado desde notifications`

- `STATE-P2-05`
  `Follow/unfollow implementado de forma dispersa y directa desde pantallas`

- `RULES-P2-04`
  `Regla de payout profile no uniforme según el consumidor`

## Priority Order For Future Execution Plan

1. `P0` pagos/webhook
2. `P1` authz/admin source of truth
3. `P1` money domain:
   compras, ledger, withdrawals, earnings, payout profile
4. `P1` state consistency:
   viewer/session, events globales, sales derivadas en cliente
5. `P1` persistence integrity:
   posts publish, chat storage, account archive
6. `P2` simplificación estructural:
   quitar stores legacy duplicados y centralizar reglas

## Recommended Execution Tracks

- `Track A: Security Hardening`
  webhook, admin authz, endpoint boundaries

- `Track B: Financial Truth Model`
  ledger, withdrawals, earnings, tips, payout profile, commissions

- `Track C: State and Data Contracts`
  viewer/session, invalidation strategy, eliminación de window-event sync crítica

- `Track D: Persistence Integrity`
  publicación, chat uploads, archivado de cuenta

## Stage Exit

La auditoría técnica quedó completa en seis etapas. El patrón dominante no es un bug aislado sino una combinación de:

- coexistencia de modelos legacy y nuevos
- lógica de negocio repartida entre UI, route handlers, repositorios y SQL
- persistencia parcial en flujos de dinero y contenido
- múltiples fuentes de verdad para estado crítico

El siguiente paso correcto ya no es seguir auditando sino construir un plan de ejecución por tracks, con prioridad estricta sobre `P0/P1`.
