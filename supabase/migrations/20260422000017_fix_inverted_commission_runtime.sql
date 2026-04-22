update public.user_commission_profiles
set
  creator_share_rate = 0.7000,
  platform_share_rate = 0.3000
where round(coalesce(creator_share_rate, 0)::numeric, 4) = 0.3000
  and round(coalesce(platform_share_rate, 0)::numeric, 4) = 0.7000;

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
      and p.status = 'approved'
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
  if round(v_creator_share_rate::numeric, 4) = 0.3000
    and round(v_platform_share_rate::numeric, 4) = 0.7000 then
    v_creator_share_rate := 0.7000;
    v_platform_share_rate := 0.3000;
  end if;

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
  )
  on conflict do nothing;

  return next;
end;
$$;

create or replace function public.process_internal_direct_message_purchase(
  p_buyer_user_id uuid,
  p_message_id uuid
)
returns table (
  transaction_id uuid,
  seller_user_id uuid,
  thread_id uuid,
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
  v_message record;
  v_buyer_balance record;
  v_creator_share_rate numeric(5,4) := 0.7000;
  v_platform_share_rate numeric(5,4) := 0.3000;
  v_tx_id uuid;
begin
  select
    dm.id,
    dm.thread_id,
    dm.sender_id,
    dm.kind,
    dm.metadata,
    dt.participant_low,
    dt.participant_high
  into v_message
  from public.direct_messages dm
  join public.direct_threads dt on dt.id = dm.thread_id
  where dm.id = p_message_id
  for update;

  if not found then
    raise exception 'direct_message_not_found';
  end if;

  if v_message.kind <> 'premium' then
    raise exception 'direct_message_not_premium';
  end if;

  if p_buyer_user_id not in (v_message.participant_low, v_message.participant_high) then
    raise exception 'direct_thread_forbidden';
  end if;

  if v_message.sender_id = p_buyer_user_id then
    raise exception 'cannot_buy_own_content';
  end if;

  if exists (
    select 1
    from public.direct_message_purchases dmp
    where dmp.message_id = p_message_id
      and dmp.buyer_user_id = p_buyer_user_id
  ) then
    raise exception 'direct_message_already_purchased';
  end if;

  transaction_amount := round(coalesce((v_message.metadata->>'price')::numeric, 0), 2);

  if transaction_amount <= 0 then
    raise exception 'invalid_direct_message_price';
  end if;

  insert into public.user_balances (user_id)
  values (p_buyer_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_balances (user_id)
  values (v_message.sender_id)
  on conflict (user_id) do nothing;

  select *
  into v_buyer_balance
  from public.user_balances ub
  where ub.user_id = p_buyer_user_id
  for update;

  if coalesce(v_buyer_balance.cash_available, 0) + coalesce(v_buyer_balance.bonus_available, 0) < transaction_amount then
    raise exception 'insufficient_balance';
  end if;

  bonus_used := least(coalesce(v_buyer_balance.bonus_available, 0), transaction_amount);
  cash_used := round(transaction_amount - bonus_used, 2);

  select
    ucp.creator_share_rate,
    ucp.platform_share_rate
  into v_creator_share_rate, v_platform_share_rate
  from public.user_commission_profiles ucp
  where ucp.user_id = v_message.sender_id
  order by ucp.created_at desc
  limit 1;

  v_creator_share_rate := coalesce(v_creator_share_rate, 0.7000);
  v_platform_share_rate := coalesce(v_platform_share_rate, 0.3000);
  if round(v_creator_share_rate::numeric, 4) = 0.3000
    and round(v_platform_share_rate::numeric, 4) = 0.7000 then
    v_creator_share_rate := 0.7000;
    v_platform_share_rate := 0.3000;
  end if;

  creator_amount := round(transaction_amount * v_creator_share_rate, 2);
  platform_fee_amount := round(transaction_amount - creator_amount, 2);
  seller_user_id := v_message.sender_id;
  thread_id := v_message.thread_id;

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
    v_message.sender_id,
    'direct_message',
    p_message_id,
    jsonb_build_object('channel', 'internal_balance', 'threadId', v_message.thread_id)
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
      jsonb_build_object('stage', 'direct_purchase')
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
      jsonb_build_object('stage', 'direct_purchase')
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
    v_message.sender_id,
    'user',
    'user.cash_available',
    'cash_available',
    'credit',
    creator_amount,
    jsonb_build_object('stage', 'direct_purchase')
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
      jsonb_build_object('stage', 'direct_purchase')
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
  where user_id = v_message.sender_id;

  insert into public.direct_message_purchases (
    message_id,
    buyer_user_id,
    amount,
    ledger_transaction_id
  )
  values (
    p_message_id,
    p_buyer_user_id,
    transaction_amount,
    v_tx_id
  )
  on conflict (message_id, buyer_user_id) do nothing;

  return next;
end;
$$;
