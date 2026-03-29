# Complete Database Model

## Objetivo
Este documento resume el modelo de base de datos objetivo de FanPush con la decisión nueva de negocio:

- todo el consumo del usuario pasa por saldo interno
- Mercado Pago se usa para fondear y retirar
- la compra premium sigue existiendo, pero `purchases` deja de ser la fuente contable
- comisiones, saldo del autor y ganancia de plataforma deben quedar discriminados por transacción

## Principios
- `auth.users` sigue siendo la identidad real.
- `public.users` y `public.profiles` siguen siendo el perfil de negocio.
- `user_meta`, `post_meta` y `media_meta` guardan metadata flexible, no ledger ni histórico financiero crítico.
- `notifications` queda como inbox visible, no como fuente de verdad monetaria.
- el saldo rápido del usuario vive en una tabla resumen.
- la verdad financiera vive en un ledger estructurado.

## Dominios

### 1. Identidad y perfil
- `users`: perfil público, `username`, `avatar_url`, `bio`.
- `profiles`: perfil privado/base, `full_name`, `email`.
- `user_meta`: metadata flexible por usuario.

Usos válidos de `user_meta`:
- `admin.featured`
- `admin.badges`
- `admin.notes`
- `creator.kyc_level`
- `notification.preferences`

No usar `user_meta` para:
- saldo
- histórico financiero
- comisiones históricas
- permisos o bloqueos críticos sin tabla estructurada

### 2. Acceso
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`

### 3. Social
- `follows`
- `likes`

### 4. Contenido
- `albums`: entidad comercial/editorial.
- `posts`: entitlement mínimo y publicación individual.
- `album_posts`: relación álbum-post.
- `media`: asset real.
- `post_meta`: metadata flexible del post.
- `media_meta`: metadata flexible del asset.

### 5. Monetización y ledger

#### `purchases`
Se mantiene para entitlement premium:
- qué usuario compró qué post
- acceso a media bloqueada
- historial de compra visible

No debe usarse como fuente final de balance ni revenue.

#### `user_commission_profiles`
Histórico de configuraciones de comisión por creador.

Campos relevantes:
- `user_id`
- `creator_share_rate`
- `platform_share_rate`
- `reason`
- `updated_by`
- `created_at`

Cada transacción monetaria debe guardar su propio snapshot. Nunca recalcular shares con el profile actual.

#### `user_balances`
Una fila por usuario. Es el resumen rápido de su saldo.

Buckets recomendados:
- `cash_available`
- `cash_pending`
- `cash_reserved`
- `bonus_available`

Acumulados útiles:
- `lifetime_deposited`
- `lifetime_spent`
- `lifetime_earned`
- `lifetime_withdrawn`

`user_balances` es tabla resumen, no fuente contable final.

#### `ledger_transactions`
Una fila por operación económica lógica.

Campos clave:
- `kind`: `deposit`, `purchase`, `tip`, `donation`, `bonus_grant`, `bonus_reversal`, `payout_request`, `payout_paid`, `refund`, `chargeback`, `admin_adjustment`
- `status`
- `transaction_amount`
- `creator_share_rate`
- `platform_share_rate`
- `creator_amount`
- `platform_fee_amount`
- `bonus_amount`
- `buyer_user_id`
- `recipient_user_id`
- `source_type`
- `source_id`
- `external_provider`
- `provider_payment_id`
- `external_reference`
- `metadata`

Regla central:
- el saldo del autor sale de `creator_amount`
- la ganancia de plataforma sale de `platform_fee_amount`
- `transaction_amount` es el bruto, no el neto del autor

Ejemplo:
- compra de 100
- share autor 70%
- share plataforma 30%
- `transaction_amount = 100`
- `creator_amount = 70`
- `platform_fee_amount = 30`

Si mañana el admin cambia al 100%, la transacción nueva guarda:
- `creator_amount = 100`
- `platform_fee_amount = 0`

El histórico anterior no cambia.

#### `ledger_entries`
Es el detalle de movimientos contables por cuenta.

Ejemplos de `account_code`:
- `user.cash_available`
- `user.cash_pending`
- `user.cash_reserved`
- `user.bonus_available`
- `platform.user_funds_liability`
- `platform.fee_revenue`
- `platform.bonus_expense`
- `platform.payouts_payable`
- `provider.mercadopago_clearing`
- `provider.bank_settlement`

Cada `ledger_transaction` puede generar varias `ledger_entries`.

Ejemplo compra con saldo:
- comprador: débito `user.cash_available` por 100
- autor: crédito `user.cash_pending` o `user.cash_available` por 70
- plataforma: crédito `platform.fee_revenue` por 30
- plataforma/liability: ajuste según diseño de custodia

#### `withdrawal_requests`
Modela el retiro del creador:
- requested
- reserved
- paid
- rejected
- cancelled

Cuando el creador pide retiro:
- baja de `cash_available`
- sube a `cash_reserved`

Cuando se paga:
- baja `cash_reserved`
- queda registrada salida externa

#### `provider_movements`
Movimientos externos del proveedor de pagos:
- depósitos aprobados
- payouts enviados
- refunds
- chargebacks

Sirve para conciliación con Mercado Pago.

#### `provider_balance_snapshots`
Snapshots periódicos del saldo real externo.

Sirve para matchear:
- dinero real fuera del sistema
- obligaciones con usuarios
- revenue acumulado de plataforma

## Flujos

### Fondeo
1. Mercado Pago aprueba depósito.
2. Se crea `ledger_transaction(kind=deposit)`.
3. Se generan entries.
4. Sube `cash_available` del usuario.

Esto no es revenue.

### Compra
1. Usuario gasta saldo interno.
2. Se crea `ledger_transaction(kind=purchase)`.
3. Se guarda snapshot de share.
4. Se crean `ledger_entries`.
5. Se crean `purchases` para entitlement.

### Tip / donation
1. Usuario gasta saldo interno.
2. Se crea `ledger_transaction(kind=tip|donation)`.
3. Se guarda snapshot de share.
4. Se acredita al receptor.
5. `notifications` sólo informa.

### Bonus de plataforma
1. Admin entrega saldo promocional.
2. Se crea `ledger_transaction(kind=bonus_grant)`.
3. Sube `bonus_available`.
4. Queda registrado como costo promocional, no como revenue.

### Retiro
1. Creador solicita retiro.
2. `cash_available -> cash_reserved`
3. Cuando se paga: `payout_paid`
4. Se registra `provider_movement`

## Qué métricas salen bien con este modelo
- saldo disponible por usuario
- saldo reservado por retiros
- saldo bonus por usuario
- dinero total adeudado a usuarios
- ingreso real de plataforma
- revenue por autor
- revenue por tipo de operación
- conciliación contra Mercado Pago

## Qué no debe seguir haciéndose
- parsear montos de propina desde `notifications.message`
- calcular revenue desde `purchases` solamente
- recalcular shares históricos con la comisión actual
- guardar histórico financiero dentro de `user_meta`

## Orden de implementación recomendado
1. crear tablas nuevas del ledger
2. seguir manteniendo `purchases` sólo para acceso premium
3. empezar a escribir nuevas compras/tips al ledger
4. migrar retiros al ledger
5. dejar `notifications` sólo como inbox
6. backfill histórico desde `purchases`, `tips` y retiros legacy
