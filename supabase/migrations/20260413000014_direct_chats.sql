create table if not exists public.direct_threads (
  id uuid primary key default uuid_generate_v4(),
  participant_low uuid not null references auth.users(id) on delete cascade,
  participant_high uuid not null references auth.users(id) on delete cascade,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  last_sender_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_low <> participant_high),
  check (participant_low < participant_high)
);

create unique index if not exists direct_threads_participants_uniq
  on public.direct_threads (participant_low, participant_high);

create index if not exists direct_threads_last_message_idx
  on public.direct_threads (last_message_at desc);

drop trigger if exists direct_threads_set_updated_at on public.direct_threads;
create trigger direct_threads_set_updated_at
before update on public.direct_threads
for each row execute procedure public.set_row_updated_at();

create table if not exists public.direct_thread_members (
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pinned boolean not null default false,
  force_unread boolean not null default false,
  hidden boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists direct_thread_members_user_id_idx
  on public.direct_thread_members (user_id, updated_at desc);

drop trigger if exists direct_thread_members_set_updated_at on public.direct_thread_members;
create trigger direct_thread_members_set_updated_at
before update on public.direct_thread_members
for each row execute procedure public.set_row_updated_at();

create table if not exists public.direct_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (kind in ('text', 'attachment', 'premium', 'system'))
);

create index if not exists direct_messages_thread_id_created_at_idx
  on public.direct_messages (thread_id, created_at asc);

create index if not exists direct_messages_sender_id_created_at_idx
  on public.direct_messages (sender_id, created_at desc);

create table if not exists public.direct_message_purchases (
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  ledger_transaction_id uuid references public.ledger_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (message_id, buyer_user_id),
  check (amount >= 0)
);

create index if not exists direct_message_purchases_buyer_created_at_idx
  on public.direct_message_purchases (buyer_user_id, created_at desc);

create index if not exists direct_message_purchases_message_idx
  on public.direct_message_purchases (message_id, created_at desc);

create table if not exists public.direct_user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create index if not exists direct_user_blocks_blocked_idx
  on public.direct_user_blocks (blocked_user_id, created_at desc);

alter table public.direct_threads enable row level security;
alter table public.direct_thread_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.direct_message_purchases enable row level security;
alter table public.direct_user_blocks enable row level security;

drop policy if exists "direct_threads_select_own" on public.direct_threads;
create policy "direct_threads_select_own"
on public.direct_threads
for select
using (auth.uid() in (participant_low, participant_high));

drop policy if exists "direct_thread_members_select_own" on public.direct_thread_members;
create policy "direct_thread_members_select_own"
on public.direct_thread_members
for select
using (auth.uid() = user_id);

drop policy if exists "direct_messages_select_own_thread" on public.direct_messages;
create policy "direct_messages_select_own_thread"
on public.direct_messages
for select
using (
  exists (
    select 1
    from public.direct_thread_members m
    where m.thread_id = direct_messages.thread_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "direct_message_purchases_select_own" on public.direct_message_purchases;
create policy "direct_message_purchases_select_own"
on public.direct_message_purchases
for select
using (
  auth.uid() = buyer_user_id
  or exists (
    select 1
    from public.direct_messages dm
    join public.direct_threads dt on dt.id = dm.thread_id
    where dm.id = direct_message_purchases.message_id
      and auth.uid() in (dt.participant_low, dt.participant_high)
  )
);

drop policy if exists "direct_user_blocks_select_own" on public.direct_user_blocks;
create policy "direct_user_blocks_select_own"
on public.direct_user_blocks
for select
using (auth.uid() = blocker_user_id);

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
    jsonb_build_object('channel', 'internal_balance', 'thread_id', v_message.thread_id)
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
      jsonb_build_object('stage', 'purchase', 'source', 'direct_message')
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
      jsonb_build_object('stage', 'purchase', 'source', 'direct_message')
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
    jsonb_build_object('stage', 'purchase', 'source', 'direct_message')
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
      jsonb_build_object('stage', 'purchase', 'source', 'direct_message')
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
  );

  insert into public.notifications (
    user_id,
    actor_id,
    entity_id,
    type,
    message,
    is_read
  )
  values (
    v_message.sender_id,
    p_buyer_user_id,
    p_message_id,
    'purchase',
    'compró el contenido privado que enviaste por chat.',
    false
  );

  return next;
end;
$$;
