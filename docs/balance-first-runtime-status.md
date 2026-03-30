# Balance-First Runtime Status

## Objetivo
FanPush quedó encaminado al modelo `balance-first`:

- Mercado Pago se usa para fondear saldo
- compras y propinas consumen saldo interno
- `purchases` sigue siendo entitlement premium
- `notifications` sigue siendo inbox visible, no ledger

## Tablas activas

### Núcleo financiero
- `user_balances`: resumen rápido del saldo por usuario
- `ledger_transactions`: operación económica lógica
- `ledger_entries`: detalle contable por movimiento
- `user_commission_profiles`: histórico de shares por creador
- `withdrawal_requests`: retiros estructurados
- `provider_movements`: movimientos externos con Mercado Pago
- `provider_balance_snapshots`: snapshots para conciliación

### Compatibilidad
- `purchases`: acceso premium y compras visibles
- `notifications`: inbox y algunos lectores legacy

## Endpoints relevantes

### Fondeo
- `POST /api/mercadopago/preference`
  - `kind = "deposit"`
  - crea checkout externo de Mercado Pago
- `POST /api/mercadopago/finalize`
  - acredita el depósito en ledger y `user_balances`

### Consumo interno
- `POST /api/balance/checkout`
  - `kind = "purchase"`
  - `kind = "tip"`
  - descuenta `bonus_available` primero y luego `cash_available`
  - guarda snapshot real de comisión
  - devuelve split y balance actualizado

### Estado global
- `GET /api/me`
  - ya expone balance desde `user_balances`
  - `balance`
  - `cashAvailable`
  - `cashPending`
  - `cashReserved`
  - `bonusAvailable`
  - `lifetimeDeposited`
  - `lifetimeEarned`
  - `lifetimeWithdrawn`

## Flujo actual

### 1. Cargar saldo
1. usuario entra a `/saldo`
2. selecciona monto
3. se abre Mercado Pago
4. al aprobarse, se registra `deposit`
5. sube `cash_available`

### 2. Comprar contenido
1. usuario intenta comprar un álbum
2. `POST /api/balance/checkout` procesa la compra
3. se descuenta saldo interno
4. se crea `ledger_transaction(kind = purchase)`
5. se crean `purchases` para entitlement

### 3. Enviar propina
1. usuario abre modal de propina
2. `POST /api/balance/checkout`
3. se descuenta saldo interno
4. se crea `ledger_transaction(kind = tip)`
5. se notifica al receptor

## Qué sigue pendiente
- migrar `ventas`, `earnings` y dashboard admin para leer del ledger y no de `purchases + notifications`
- agregar bonus grant real desde admin
- agregar conciliación visible de plataforma
- dejar obsoleto el checkout externo para `purchase` y `tip`
