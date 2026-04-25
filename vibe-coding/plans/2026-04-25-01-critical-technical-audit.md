# Plan

- id: 2026-04-25-01-critical-technical-audit
- title: Auditoria tecnica critica por etapas del producto y su persistencia
- type: plan
- scope: plan-only
- status: approved
- requested_by: matias
- approved_by: matias
- owner: vibe-agent
- files_allowed:
  - app/**
  - components/**
  - lib/**
  - services/**
  - supabase/**
  - scripts/**
  - vibe-coding/**
- files_blocked:
  - No aplicar cambios de producto
  - No tocar contratos existentes
  - No ejecutar migraciones
  - No corregir bugs en esta fase

## Goal

Construir una auditoria tecnica exhaustiva, de varias etapas y orientada a riesgo critico, que detecte:

- estados mal manejados o inconsistentes
- llamadas API incorrectas, inseguras o ambiguas
- flujos que aparentan funcionar pero no persisten o no impactan la DB como deberian
- reglas de negocio duplicadas, contradictorias o dificiles de rastrear
- zonas de codigo donde la logica es confusa para humanos y LLMs al punto de aumentar el riesgo de errores reales

La salida de esta auditoria no es una correccion. La salida es evidencia en archivos Markdown que luego permitan armar un plan de ejecucion.

## Critical Only

Quedan fuera de alcance:

- mejoras visuales
- mejoras UX/UI
- refactors cosmeticos
- optimizaciones opcionales
- cambios de estilo sin impacto funcional

Solo cuentan problemas con alguna de estas caracteristicas:

- pueden corromper datos o dejar persistencia parcial
- permiten operaciones no autorizadas o validaciones insuficientes
- rompen reglas de dinero, compras, saldo, comisiones o desbloqueos
- generan falsos positivos de exito en UI
- dejan multiples fuentes de verdad sin sincronizacion
- implementan la misma regla con criterios distintos
- hacen que el sistema sea dificil de modificar sin alto riesgo de regresion

## Audit Outputs

Cada etapa debe dejar un archivo Markdown propio en `vibe-coding/plans/` usando esta convención:

- `2026-04-25-01-critical-technical-audit-stage-01-architecture-and-entities.md`
- `2026-04-25-01-critical-technical-audit-stage-02-client-state-and-fetching.md`
- `2026-04-25-01-critical-technical-audit-stage-03-api-security-and-authz.md`
- `2026-04-25-01-critical-technical-audit-stage-04-persistence-and-db-impact.md`
- `2026-04-25-01-critical-technical-audit-stage-05-business-rules-consistency.md`
- `2026-04-25-01-critical-technical-audit-stage-06-critical-findings-summary.md`

Cada archivo debe seguir la plantilla `vibe-coding/templates/audit-stage-report.md`.

## Method

La auditoria no se hace por archivo aislado. Se hace por flujo y por entidad.

Para cada dominio critico:

1. partir desde la accion del usuario
2. ubicar el estado local o global implicado
3. ubicar la llamada al endpoint o servicio
4. seguir el handler server-side y helpers intermedios
5. identificar tablas, buckets o side effects que deberian verse afectados
6. volver a la lectura posterior que rehidrata la UI
7. comparar expectativa visible contra persistencia real y contra regla de negocio

Tambien se hace el cruce inverso:

1. partir desde tablas, migraciones y repositorios sensibles
2. enumerar todos los consumers y writers
3. detectar reglas implementadas de forma distinta segun el punto de entrada

## Domains In Scope

Orden de prioridad de auditoria:

1. compras, checkout, balance, Mercado Pago, earnings, ledger, withdrawals
2. mensajes directos, compras premium por chat, desbloqueos y propinas
3. auth, sesiones, permisos, admin y author roles
4. posts, feed, perfil, creacion y acceso a contenido bloqueado
5. notification center y eventos derivados
6. account settings, delete account y otros flujos destructivos

## Steps

1. Preparar el mapa de arquitectura, entidades y rutas criticas.
   Salida: stage 01.

2. Auditar manejo de estado cliente y fetching.
   Revisar `useState`, `useEffect`, derived state, RTK Query, invalidaciones, optimistic UI, fallbacks de loading/error y sincronizacion entre cache y slices.
   Salida: stage 02.

3. Auditar seguridad, autenticacion y autorizacion en APIs.
   Revisar `app/api/**`, uso de `getAuthenticatedUser`, service role, ownership checks, validaciones de input y confianza excesiva en datos del cliente.
   Salida: stage 03.

4. Auditar persistencia real y consistencia con DB.
   Verificar que cada flujo mutante tenga impacto durable y lectura coherente posterior.
   Revisar writes parciales, estados sin rollback, side effects no observables y desalineaciones entre migraciones y codigo.
   Salida: stage 04.

5. Auditar reglas de negocio y su consistencia transversal.
   Catalogar reglas por dominio y detectar diferencias de implementacion, naming ambiguo, estados equivalentes con distinto nombre y validaciones solo frontend.
   Salida: stage 05.

6. Consolidar hallazgos criticos y preparar backlog de remediacion.
   No incluir soluciones detalladas aun. Solo severidad, evidencia, archivos, riesgo, dependencia entre hallazgos y orden recomendado de ataque.
   Salida: stage 06.

## Required Evidence

Ningun hallazgo debe entrar sin evidencia trazable. Cada hallazgo debe enlazar:

- archivo o endpoint involucrado
- ruta o flujo del producto
- tabla, bucket o repositorio afectado si aplica
- descripcion de por que es critico
- comportamiento esperado
- comportamiento observado o inferido desde el codigo

## Severity Model

- `P0`: seguridad, permisos, dinero, corrupcion de datos, operaciones irreversibles mal protegidas
- `P1`: persistencia rota, estados falsos de exito, reglas de negocio contradictorias, side effects que no cierran
- `P2`: complejidad estructural que impide razonar o evoluciona con alto riesgo

No registrar `P3` ni mejoras opcionales en esta auditoria.

## Acceptance Criteria

- Existe un plan de auditoria exhaustivo y ejecutable por etapas.
- Cada etapa produce un `.md` separado con evidencia y hallazgos criticos.
- La auditoria evita fixes y se concentra en deteccion, trazabilidad y priorizacion.
- El resultado final permite armar un plan de ejecucion independiente y defendible.
