create extension if not exists "uuid-ossp";

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_commission_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_share_rate numeric(5,4) not null,
  platform_share_rate numeric(5,4) not null,
  reason text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (creator_share_rate >= 0 and creator_share_rate <= 1),
  check (platform_share_rate >= 0 and platform_share_rate <= 1),
  check (round((creator_share_rate + platform_share_rate)::numeric, 4) = 1.0000)
);

create index if not exists user_commission_profiles_user_id_created_at_idx
  on public.user_commission_profiles (user_id, created_at desc);

alter table public.user_commission_profiles enable row level security;

drop policy if exists "user_commission_profiles_select_own" on public.user_commission_profiles;
create policy "user_commission_profiles_select_own"
on public.user_commission_profiles
for select
using (auth.uid() = user_id);

create table if not exists public.user_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash_available numeric(14,2) not null default 0,
  cash_pending numeric(14,2) not null default 0,
  cash_reserved numeric(14,2) not null default 0,
  bonus_available numeric(14,2) not null default 0,
  lifetime_deposited numeric(14,2) not null default 0,
  lifetime_spent numeric(14,2) not null default 0,
  lifetime_earned numeric(14,2) not null default 0,
  lifetime_withdrawn numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cash_available >= 0),
  check (cash_pending >= 0),
  check (cash_reserved >= 0),
  check (bonus_available >= 0),
  check (lifetime_deposited >= 0),
  check (lifetime_spent >= 0),
  check (lifetime_earned >= 0),
  check (lifetime_withdrawn >= 0)
);

drop trigger if exists user_balances_set_updated_at on public.user_balances;
create trigger user_balances_set_updated_at
before update on public.user_balances
for each row execute procedure public.set_row_updated_at();

insert into public.user_balances (user_id)
select au.id
from auth.users au
left join public.user_balances ub on ub.user_id = au.id
where ub.user_id is null
on conflict (user_id) do nothing;

alter table public.user_balances enable row level security;

drop policy if exists "user_balances_select_own" on public.user_balances;
create policy "user_balances_select_own"
on public.user_balances
for select
using (auth.uid() = user_id);

create table if not exists public.ledger_transactions (
  id uuid primary key default uuid_generate_v4(),
  kind text not null,
  status text not null default 'pending',
  currency text not null default 'ARS',
  transaction_amount numeric(14,2) not null default 0,
  creator_share_rate numeric(5,4),
  platform_share_rate numeric(5,4),
  creator_amount numeric(14,2) not null default 0,
  platform_fee_amount numeric(14,2) not null default 0,
  bonus_amount numeric(14,2) not null default 0,
  buyer_user_id uuid references auth.users(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  source_type text,
  source_id uuid,
  external_provider text,
  external_reference text,
  provider_payment_id text,
  metadata jsonb not null default '{}'::jsonb,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    kind in (
      'deposit',
      'purchase',
      'tip',
      'donation',
      'bonus_grant',
      'bonus_reversal',
      'payout_request',
      'payout_paid',
      'refund',
      'chargeback',
      'admin_adjustment'
    )
  ),
  check (
    status in (
      'pending',
      'approved',
      'settled',
      'reserved',
      'rejected',
      'cancelled',
      'refunded',
      'failed'
    )
  ),
  check (transaction_amount >= 0),
  check (creator_amount >= 0),
  check (platform_fee_amount >= 0),
  check (bonus_amount >= 0),
  check (
    (
      creator_share_rate is null
      and platform_share_rate is null
    ) or (
      creator_share_rate >= 0
      and creator_share_rate <= 1
      and platform_share_rate >= 0
      and platform_share_rate <= 1
      and round((creator_share_rate + platform_share_rate)::numeric, 4) = 1.0000
    )
  ),
  check (
    round((creator_amount + platform_fee_amount)::numeric, 2) <= round(transaction_amount::numeric, 2)
  )
);

drop trigger if exists ledger_transactions_set_updated_at on public.ledger_transactions;
create trigger ledger_transactions_set_updated_at
before update on public.ledger_transactions
for each row execute procedure public.set_row_updated_at();

create index if not exists ledger_transactions_buyer_user_id_idx
  on public.ledger_transactions (buyer_user_id, created_at desc);

create index if not exists ledger_transactions_recipient_user_id_idx
  on public.ledger_transactions (recipient_user_id, created_at desc);

create index if not exists ledger_transactions_kind_status_idx
  on public.ledger_transactions (kind, status, created_at desc);

create index if not exists ledger_transactions_source_idx
  on public.ledger_transactions (source_type, source_id);

create index if not exists ledger_transactions_external_reference_idx
  on public.ledger_transactions (external_reference);

create unique index if not exists ledger_transactions_provider_payment_id_uniq
  on public.ledger_transactions (external_provider, provider_payment_id)
  where provider_payment_id is not null;

alter table public.ledger_transactions enable row level security;

drop policy if exists "ledger_transactions_select_own" on public.ledger_transactions;
create policy "ledger_transactions_select_own"
on public.ledger_transactions
for select
using (
  auth.uid() = buyer_user_id
  or auth.uid() = recipient_user_id
);

create table if not exists public.ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entry_scope text not null,
  account_code text not null,
  balance_bucket text,
  direction text not null,
  amount numeric(14,2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (entry_scope in ('user', 'platform', 'provider')),
  check (
    balance_bucket is null
    or balance_bucket in ('cash_available', 'cash_pending', 'cash_reserved', 'bonus_available')
  ),
  check (direction in ('debit', 'credit')),
  check (amount > 0)
);

create index if not exists ledger_entries_transaction_id_idx
  on public.ledger_entries (transaction_id);

create index if not exists ledger_entries_user_id_created_at_idx
  on public.ledger_entries (user_id, created_at desc);

create index if not exists ledger_entries_account_code_idx
  on public.ledger_entries (account_code, created_at desc);

alter table public.ledger_entries enable row level security;

drop policy if exists "ledger_entries_select_own" on public.ledger_entries;
create policy "ledger_entries_select_own"
on public.ledger_entries
for select
using (user_id is not null and auth.uid() = user_id);

create table if not exists public.withdrawal_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'requested',
  ledger_transaction_id uuid references public.ledger_transactions(id) on delete set null,
  provider_reference text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount > 0),
  check (status in ('requested', 'reserved', 'paid', 'rejected', 'cancelled'))
);

drop trigger if exists withdrawal_requests_set_updated_at on public.withdrawal_requests;
create trigger withdrawal_requests_set_updated_at
before update on public.withdrawal_requests
for each row execute procedure public.set_row_updated_at();

create index if not exists withdrawal_requests_user_id_requested_at_idx
  on public.withdrawal_requests (user_id, requested_at desc);

create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests (status, requested_at desc);

alter table public.withdrawal_requests enable row level security;

drop policy if exists "withdrawal_requests_select_own" on public.withdrawal_requests;
create policy "withdrawal_requests_select_own"
on public.withdrawal_requests
for select
using (auth.uid() = user_id);

create table if not exists public.provider_movements (
  id uuid primary key default uuid_generate_v4(),
  provider text not null default 'mercadopago',
  movement_kind text not null,
  status text not null default 'recorded',
  currency text not null default 'ARS',
  amount numeric(14,2) not null,
  external_reference text not null,
  user_id uuid references auth.users(id) on delete set null,
  ledger_transaction_id uuid references public.ledger_transactions(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (amount >= 0),
  check (
    movement_kind in (
      'deposit_in',
      'payout_out',
      'refund_out',
      'chargeback_in',
      'manual_adjustment'
    )
  ),
  check (
    status in (
      'recorded',
      'approved',
      'settled',
      'rejected',
      'cancelled',
      'failed'
    )
  ),
  unique (provider, external_reference)
);

alter table public.provider_movements enable row level security;

create table if not exists public.provider_balance_snapshots (
  id uuid primary key default uuid_generate_v4(),
  provider text not null default 'mercadopago',
  account_label text not null default 'default',
  currency text not null default 'ARS',
  balance_amount numeric(14,2) not null,
  snapshot_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (balance_amount >= 0),
  unique (provider, account_label, snapshot_at)
);

alter table public.provider_balance_snapshots enable row level security;

create or replace view public.platform_financial_summary as
select
  coalesce(sum(ub.cash_available), 0)::numeric(14,2) as users_cash_available,
  coalesce(sum(ub.cash_pending), 0)::numeric(14,2) as users_cash_pending,
  coalesce(sum(ub.cash_reserved), 0)::numeric(14,2) as users_cash_reserved,
  coalesce(sum(ub.bonus_available), 0)::numeric(14,2) as users_bonus_available,
  (
    select coalesce(sum(lt.transaction_amount), 0)::numeric(14,2)
    from public.ledger_transactions lt
    where lt.status in ('approved', 'settled')
  ) as transaction_gross_approved,
  (
    select coalesce(sum(lt.creator_amount), 0)::numeric(14,2)
    from public.ledger_transactions lt
    where lt.status in ('approved', 'settled')
  ) as creators_gross_approved,
  (
    select coalesce(sum(lt.platform_fee_amount), 0)::numeric(14,2)
    from public.ledger_transactions lt
    where lt.status in ('approved', 'settled')
  ) as platform_fee_gross_approved
from public.user_balances ub;
