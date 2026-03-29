create table if not exists public.user_meta (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meta_key text not null,
  meta_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, meta_key)
);

create index if not exists user_meta_user_id_idx on public.user_meta (user_id);
create index if not exists user_meta_key_idx on public.user_meta (meta_key);

alter table public.user_meta enable row level security;

drop policy if exists "user_meta_select_own" on public.user_meta;
create policy "user_meta_select_own"
on public.user_meta
for select
using (auth.uid() = user_id);

drop policy if exists "user_meta_insert_own" on public.user_meta;
create policy "user_meta_insert_own"
on public.user_meta
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_meta_update_own" on public.user_meta;
create policy "user_meta_update_own"
on public.user_meta
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
