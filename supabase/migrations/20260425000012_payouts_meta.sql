create table if not exists public.payouts_meta (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meta_key text not null,
  meta_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, meta_key)
);

create index if not exists payouts_meta_user_id_idx on public.payouts_meta (user_id);
create index if not exists payouts_meta_key_idx on public.payouts_meta (meta_key);

drop trigger if exists payouts_meta_set_updated_at on public.payouts_meta;
create trigger payouts_meta_set_updated_at
before update on public.payouts_meta
for each row execute procedure public.set_row_updated_at();

alter table public.payouts_meta enable row level security;

drop policy if exists "payouts_meta_select_own" on public.payouts_meta;
create policy "payouts_meta_select_own"
on public.payouts_meta
for select
using (auth.uid() = user_id);

drop policy if exists "payouts_meta_insert_own" on public.payouts_meta;
create policy "payouts_meta_insert_own"
on public.payouts_meta
for insert
with check (auth.uid() = user_id);

drop policy if exists "payouts_meta_update_own" on public.payouts_meta;
create policy "payouts_meta_update_own"
on public.payouts_meta
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
