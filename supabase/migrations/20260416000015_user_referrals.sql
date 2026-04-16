create extension if not exists "uuid-ossp";

create table if not exists public.user_referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_referrals_referrer_created_at_idx
  on public.user_referrals (referrer_user_id, created_at desc);

create index if not exists user_referrals_referral_code_idx
  on public.user_referrals (referral_code);

alter table public.user_referrals enable row level security;

drop policy if exists "user_referrals_select_own" on public.user_referrals;
create policy "user_referrals_select_own"
  on public.user_referrals
  for select
  to authenticated
  using (auth.uid() = referrer_user_id);
