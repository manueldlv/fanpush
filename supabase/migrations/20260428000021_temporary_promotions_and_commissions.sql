alter table public.author_promotions
add column if not exists expires_at timestamptz;

alter table public.user_commission_profiles
add column if not exists expires_at timestamptz;

create index if not exists author_promotions_expires_at_idx
  on public.author_promotions (expires_at);

create index if not exists user_commission_profiles_expires_at_idx
  on public.user_commission_profiles (user_id, expires_at desc, created_at desc);
