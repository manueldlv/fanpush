create or replace function public.process_internal_album_purchase(
  p_buyer_user_id uuid,
  p_album_id uuid
)
returns table (
  transaction_id uuid,
  seller_user_id uuid,
  transaction_amount numeric,
  bonus_used numeric,
  cash_used numeric,
  creator_amount numeric,
  platform_fee_amount numeric
)
language plpgsql
security definer
as $$
declare
  v_album record;
  v_buyer_balance record;
  v_creator_share_rate numeric(5,4) := 0.7000;
  v_platform_share_rate numeric(5,4) := 0.3000;
  v_tx_id uuid;
begin
  select a.id, a.user_id, a.price
  into v_album
  from public.albums a
  where a.id = p_album_id;

  if not found then
    raise exception 'album_not_found';
  end if;

  if v_album.user_id = p_buyer_user_id then
    raise exception 'cannot_buy_own_content';
  end if;

  if coalesce(v_album.price, 0) <= 0 then
    raise exception 'invalid_album_price';
  end if;

  if not exists (
    select 1
    from public.album_posts ap
    where ap.album_id = p_album_id
  ) then
    raise exception 'album_has_no_posts';
  end if;

  if exists (
    select 1
    from public.purchases p
    where p.user_id = p_buyer_user_id
      and p.post_id in (
        select ap.post_id
        from public.album_posts ap
        where ap.album_id = p_album_id
      )
  ) then
    raise exception 'album_already_purchased';
  end if;

  insert into public.user_balances (user_id)
  values (p_buyer_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_balances (user_id)
  values (v_album.user_id)
  on conflict (user_id) do nothing;

  select *
  into v_buyer_balance
  from public.user_balances ub
  where ub.user_id = p_buyer_user_id
  for update;

  if coalesce(v_buyer_balance.cash_available, 0) + coalesce(v_buyer_balance.bonus_available, 0) < coalesce(v_album.price, 0) then
    raise exception 'insufficient_balance';
  end if;

  transaction_amount := round(v_album.price::numeric, 2);
  bonus_used := least(coalesce(v_buyer_balance.bonus_available, 0), transaction_amount);
  cash_used := round(transaction_amount - bonus_used, 2);

  select
    ucp.creator_share_rate,
    ucp.platform_share_rate
  into v_creator_share_rate, v_platform_share_rate
  from public.user_commission_profiles ucp
  where ucp.user_id = v_album.user_id
  order by ucp.created_at desc
  limit 1;

  v_creator_share_rate := coalesce(v_creator_share_rate, 0.7000);
  v_platform_share_rate := coalesce(v_platform_share_rate, 0.3000);

  creator_amount := round(transaction_amount * v_creator_share_rate, 2);
  platform_fee_amount := round(transaction_amount - creator_amount, 2);
  seller_user_id := v_album.user_id;

  insert into public.ledger_transactions (
    kind,
    status,
    currency,
    transaction_amount,
    creator_share_rate,
    platform_share_rate,
    creator_amount,
    platform_fee_amount,
    buyer_user_id,
    recipient_user_id,
    source_type,
    source_id,
    metadata
  )
  values (
    'purchase',
    'approved',
    'ARS',
    transaction_amount,
    v_creator_share_rate,
    v_platform_share_rate,
    creator_amount,
    platform_fee_amount,
    p_buyer_user_id,
    v_album.user_id,
    'album',
    p_album_id,
    jsonb_build_object('channel', 'internal_balance')
  )
  returning id into v_tx_id;

  transaction_id := v_tx_id;

  if bonus_used > 0 then
    insert into public.ledger_entries (
      transaction_id,
      user_id,
      entry_scope,
      account_code,
      balance_bucket,
      direction,
      amount,
      metadata
    )
    values (
      v_tx_id,
      p_buyer_user_id,
      'user',
      'user.bonus_available',
      'bonus_available',
      'debit',
      bonus_used,
      jsonb_build_object('stage', 'purchase')
    );
  end if;

  if cash_used > 0 then
    insert into public.ledger_entries (
      transaction_id,
      user_id,
      entry_scope,
      account_code,
      balance_bucket,
      direction,
      amount,
      metadata
    )
    values (
      v_tx_id,
      p_buyer_user_id,
      'user',
      'user.cash_available',
      'cash_available',
      'debit',
      cash_used,
      jsonb_build_object('stage', 'purchase')
    );
  end if;

  insert into public.ledger_entries (
    transaction_id,
    user_id,
    entry_scope,
    account_code,
    balance_bucket,
    direction,
    amount,
    metadata
  )
  values (
    v_tx_id,
    v_album.user_id,
    'user',
    'user.cash_available',
    'cash_available',
    'credit',
    creator_amount,
    jsonb_build_object('stage', 'purchase')
  );

  if platform_fee_amount > 0 then
    insert into public.ledger_entries (
      transaction_id,
      entry_scope,
      account_code,
      direction,
      amount,
      metadata
    )
    values (
      v_tx_id,
      'platform',
      'platform.fee_revenue',
      'credit',
      platform_fee_amount,
      jsonb_build_object('stage', 'purchase')
    );
  end if;

  update public.user_balances
  set
    cash_available = cash_available - cash_used,
    bonus_available = bonus_available - bonus_used,
    lifetime_spent = lifetime_spent + transaction_amount,
    updated_at = now()
  where user_id = p_buyer_user_id;

  update public.user_balances
  set
    cash_available = cash_available + creator_amount,
    lifetime_earned = lifetime_earned + creator_amount,
    updated_at = now()
  where user_id = v_album.user_id;

  insert into public.purchases (
    user_id,
    post_id,
    payment_id,
    amount,
    status
  )
  select
    p_buyer_user_id,
    ap.post_id,
    concat('balance:', v_tx_id::text),
    case
      when row_number() over (order by ap.position asc, ap.created_at asc, ap.post_id asc) = 1
        then transaction_amount
      else 0
    end,
    'approved'
  from public.album_posts ap
  where ap.album_id = p_album_id
  order by ap.position asc, ap.created_at asc, ap.post_id asc;

  insert into public.notifications (
    user_id,
    actor_id,
    entity_id,
    type,
    message,
    is_read
  )
  values (
    v_album.user_id,
    p_buyer_user_id,
    p_album_id,
    'purchase',
    'compró tu contenido.',
    false
  );

  return next;
end;
$$;

create or replace function public.process_internal_tip_payment(
  p_buyer_user_id uuid,
  p_recipient_user_id uuid,
  p_amount numeric
)
returns table (
  transaction_id uuid,
  transaction_amount numeric,
  bonus_used numeric,
  cash_used numeric,
  creator_amount numeric,
  platform_fee_amount numeric
)
language plpgsql
security definer
as $$
declare
  v_buyer_balance record;
  v_creator_share_rate numeric(5,4) := 0.7000;
  v_platform_share_rate numeric(5,4) := 0.3000;
  v_tx_id uuid;
begin
  if p_buyer_user_id = p_recipient_user_id then
    raise exception 'cannot_tip_self';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'invalid_tip_amount';
  end if;

  if not exists (
    select 1
    from auth.users au
    where au.id = p_recipient_user_id
  ) then
    raise exception 'recipient_not_found';
  end if;

  insert into public.user_balances (user_id)
  values (p_buyer_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_balances (user_id)
  values (p_recipient_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_buyer_balance
  from public.user_balances ub
  where ub.user_id = p_buyer_user_id
  for update;

  if coalesce(v_buyer_balance.cash_available, 0) + coalesce(v_buyer_balance.bonus_available, 0) < coalesce(p_amount, 0) then
    raise exception 'insufficient_balance';
  end if;

  transaction_amount := round(p_amount::numeric, 2);
  bonus_used := least(coalesce(v_buyer_balance.bonus_available, 0), transaction_amount);
  cash_used := round(transaction_amount - bonus_used, 2);

  select
    ucp.creator_share_rate,
    ucp.platform_share_rate
  into v_creator_share_rate, v_platform_share_rate
  from public.user_commission_profiles ucp
  where ucp.user_id = p_recipient_user_id
  order by ucp.created_at desc
  limit 1;

  v_creator_share_rate := coalesce(v_creator_share_rate, 0.7000);
  v_platform_share_rate := coalesce(v_platform_share_rate, 0.3000);

  creator_amount := round(transaction_amount * v_creator_share_rate, 2);
  platform_fee_amount := round(transaction_amount - creator_amount, 2);

  insert into public.ledger_transactions (
    kind,
    status,
    currency,
    transaction_amount,
    creator_share_rate,
    platform_share_rate,
    creator_amount,
    platform_fee_amount,
    buyer_user_id,
    recipient_user_id,
    source_type,
    source_id,
    metadata
  )
  values (
    'tip',
    'approved',
    'ARS',
    transaction_amount,
    v_creator_share_rate,
    v_platform_share_rate,
    creator_amount,
    platform_fee_amount,
    p_buyer_user_id,
    p_recipient_user_id,
    'user',
    p_recipient_user_id,
    jsonb_build_object('channel', 'internal_balance')
  )
  returning id into v_tx_id;

  transaction_id := v_tx_id;

  if bonus_used > 0 then
    insert into public.ledger_entries (
      transaction_id,
      user_id,
      entry_scope,
      account_code,
      balance_bucket,
      direction,
      amount,
      metadata
    )
    values (
      v_tx_id,
      p_buyer_user_id,
      'user',
      'user.bonus_available',
      'bonus_available',
      'debit',
      bonus_used,
      jsonb_build_object('stage', 'tip')
    );
  end if;

  if cash_used > 0 then
    insert into public.ledger_entries (
      transaction_id,
      user_id,
      entry_scope,
      account_code,
      balance_bucket,
      direction,
      amount,
      metadata
    )
    values (
      v_tx_id,
      p_buyer_user_id,
      'user',
      'user.cash_available',
      'cash_available',
      'debit',
      cash_used,
      jsonb_build_object('stage', 'tip')
    );
  end if;

  insert into public.ledger_entries (
    transaction_id,
    user_id,
    entry_scope,
    account_code,
    balance_bucket,
    direction,
    amount,
    metadata
  )
  values (
    v_tx_id,
    p_recipient_user_id,
    'user',
    'user.cash_available',
    'cash_available',
    'credit',
    creator_amount,
    jsonb_build_object('stage', 'tip')
  );

  if platform_fee_amount > 0 then
    insert into public.ledger_entries (
      transaction_id,
      entry_scope,
      account_code,
      direction,
      amount,
      metadata
    )
    values (
      v_tx_id,
      'platform',
      'platform.fee_revenue',
      'credit',
      platform_fee_amount,
      jsonb_build_object('stage', 'tip')
    );
  end if;

  update public.user_balances
  set
    cash_available = cash_available - cash_used,
    bonus_available = bonus_available - bonus_used,
    lifetime_spent = lifetime_spent + transaction_amount,
    updated_at = now()
  where user_id = p_buyer_user_id;

  update public.user_balances
  set
    cash_available = cash_available + creator_amount,
    lifetime_earned = lifetime_earned + creator_amount,
    updated_at = now()
  where user_id = p_recipient_user_id;

  insert into public.notifications (
    user_id,
    actor_id,
    entity_id,
    type,
    message,
    is_read
  )
  values (
    p_recipient_user_id,
    p_buyer_user_id,
    v_tx_id,
    'tip',
    concat(
      'te envió una propina de ',
      trim(to_char(transaction_amount, 'FM999999999990.00')),
      ' ARS.'
    ),
    false
  );

  return next;
end;
$$;
