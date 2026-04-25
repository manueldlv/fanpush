# Execution

- id: 2026-04-25-03-phase-06-purchases-core
- phase: 06
- status: done
- date: 2026-04-25

## Changes Executed

- `lib/server/repositories/payments.ts` ahora concentra la persistencia de compras de álbum en helpers compartidos
- compra interna y compra Mercado Pago conservan la misma semántica de acreditación y notificación
- `compras` ya venía apoyada en `/api/purchases`; el core de escritura quedó más consistente

## Validation

- `npm run build`: OK

## Decision Log

- no se cambió la regla de unlock ni el shape de `purchases`
- la unificación fue solo del núcleo de persistencia para reducir drift entre motores de compra

## Last Safe Resume Point

- fase cerrada
