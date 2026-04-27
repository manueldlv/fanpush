create table if not exists public.author_promotions (
  user_id uuid primary key references public.users(id) on delete cascade,
  is_active boolean not null default true,
  promote_in_feed boolean not null default false,
  feed_rank integer not null default 9999,
  promote_in_suggestions boolean not null default false,
  suggestions_rank integer not null default 9999,
  promote_in_explore boolean not null default false,
  explore_rank integer not null default 9999,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  note text not null default ''
);

create index if not exists author_promotions_feed_idx
  on public.author_promotions (is_active, promote_in_feed, feed_rank, updated_at desc);

create index if not exists author_promotions_suggestions_idx
  on public.author_promotions (is_active, promote_in_suggestions, suggestions_rank, updated_at desc);

create index if not exists author_promotions_explore_idx
  on public.author_promotions (is_active, promote_in_explore, explore_rank, updated_at desc);

alter table public.author_promotions enable row level security;

drop policy if exists "author_promotions_public_select" on public.author_promotions;
create policy "author_promotions_public_select"
on public.author_promotions
for select
using (true);
