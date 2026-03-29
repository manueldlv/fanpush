create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (
    id,
    username
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id,
    full_name,
    email
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.user_balances (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.user_balances (user_id)
select au.id
from auth.users au
left join public.user_balances ub on ub.user_id = au.id
where ub.user_id is null
on conflict (user_id) do nothing;

alter table public.withdrawal_requests
  add column if not exists month_key text;

create unique index if not exists withdrawal_requests_user_id_month_key_open_uniq
  on public.withdrawal_requests (user_id, month_key)
  where status in ('requested', 'reserved');

create or replace function public.apply_user_balance_delta(
  target_user_id uuid,
  cash_available_delta numeric default 0,
  cash_pending_delta numeric default 0,
  cash_reserved_delta numeric default 0,
  bonus_available_delta numeric default 0,
  lifetime_deposited_delta numeric default 0,
  lifetime_spent_delta numeric default 0,
  lifetime_earned_delta numeric default 0,
  lifetime_withdrawn_delta numeric default 0
)
returns public.user_balances
language plpgsql
security definer
as $$
declare
  result public.user_balances;
begin
  insert into public.user_balances (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  update public.user_balances
  set
    cash_available = cash_available + cash_available_delta,
    cash_pending = cash_pending + cash_pending_delta,
    cash_reserved = cash_reserved + cash_reserved_delta,
    bonus_available = bonus_available + bonus_available_delta,
    lifetime_deposited = lifetime_deposited + lifetime_deposited_delta,
    lifetime_spent = lifetime_spent + lifetime_spent_delta,
    lifetime_earned = lifetime_earned + lifetime_earned_delta,
    lifetime_withdrawn = lifetime_withdrawn + lifetime_withdrawn_delta,
    updated_at = now()
  where user_id = target_user_id
  returning * into result;

  if result.cash_available < 0
    or result.cash_pending < 0
    or result.cash_reserved < 0
    or result.bonus_available < 0
    or result.lifetime_deposited < 0
    or result.lifetime_spent < 0
    or result.lifetime_earned < 0
    or result.lifetime_withdrawn < 0 then
    raise exception 'user_balances negative result for user %', target_user_id;
  end if;

  return result;
end;
$$;
