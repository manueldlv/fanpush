with affected_transactions as (
  select
    lt.id,
    lt.recipient_user_id,
    round(lt.transaction_amount::numeric * 0.7000, 2) as corrected_creator_amount,
    round(
      lt.transaction_amount::numeric
      - round(lt.transaction_amount::numeric * 0.7000, 2),
      2
    ) as corrected_platform_fee_amount,
    coalesce(lt.creator_amount, 0)::numeric as previous_creator_amount
  from public.ledger_transactions lt
  where lt.status = 'approved'
    and lt.kind in ('purchase', 'tip', 'donation')
    and round(coalesce(lt.creator_share_rate, 0)::numeric, 4) = 0.3000
    and round(coalesce(lt.platform_share_rate, 0)::numeric, 4) = 0.7000
),
updated_transactions as (
  update public.ledger_transactions lt
  set
    creator_share_rate = 0.7000,
    platform_share_rate = 0.3000,
    creator_amount = at.corrected_creator_amount,
    platform_fee_amount = at.corrected_platform_fee_amount
  from affected_transactions at
  where lt.id = at.id
  returning
    lt.id,
    at.recipient_user_id,
    at.corrected_creator_amount,
    at.corrected_platform_fee_amount,
    at.previous_creator_amount
),
updated_user_entries as (
  update public.ledger_entries le
  set amount = ut.corrected_creator_amount
  from updated_transactions ut
  where le.transaction_id = ut.id
    and le.entry_scope = 'user'
    and le.account_code = 'user.cash_available'
    and le.balance_bucket = 'cash_available'
    and le.direction = 'credit'
    and le.user_id = ut.recipient_user_id
  returning le.transaction_id
),
updated_platform_entries as (
  update public.ledger_entries le
  set amount = ut.corrected_platform_fee_amount
  from updated_transactions ut
  where le.transaction_id = ut.id
    and le.entry_scope = 'platform'
    and le.account_code = 'platform.fee_revenue'
    and le.direction = 'credit'
  returning le.transaction_id
),
balance_deltas as (
  select
    recipient_user_id as user_id,
    round(sum(corrected_creator_amount - previous_creator_amount), 2) as delta_amount
  from updated_transactions
  group by recipient_user_id
)
update public.user_balances ub
set
  cash_available = ub.cash_available + bd.delta_amount,
  lifetime_earned = ub.lifetime_earned + bd.delta_amount,
  updated_at = now()
from balance_deltas bd
where ub.user_id = bd.user_id
  and bd.delta_amount <> 0;
