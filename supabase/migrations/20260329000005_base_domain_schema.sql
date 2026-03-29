create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  bio text,
  website text,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_username_lower_uniq
  on public.users (lower(username));

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  country text,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.users (id, username, created_at, updated_at)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)),
  now(),
  now()
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, created_at, updated_at)
select
  au.id,
  coalesce(au.raw_user_meta_data->>'full_name', ''),
  au.email,
  now(),
  now()
from auth.users au
left join public.profiles pp on pp.id = au.id
where pp.id is null
on conflict (id) do nothing;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx
  on public.follows (following_id);

create table if not exists public.albums (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text,
  price numeric(12,2) not null default 0,
  visibility text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price >= 0),
  check (visibility in ('draft', 'published', 'archived', 'removed'))
);

create index if not exists albums_user_id_created_at_idx
  on public.albums (user_id, created_at desc);

create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  media_type text not null,
  is_locked boolean not null default false,
  likes_count integer not null default 0,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_type in ('image', 'video'))
);

create index if not exists posts_user_id_created_at_idx
  on public.posts (user_id, created_at desc);

create table if not exists public.album_posts (
  album_id uuid not null references public.albums(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (album_id, post_id)
);

create index if not exists album_posts_post_id_idx
  on public.album_posts (post_id);

create table if not exists public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists likes_post_id_idx
  on public.likes (post_id);

create table if not exists public.purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  payment_id text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  check (amount >= 0),
  check (status in ('approved', 'refunded', 'cancelled'))
);

create unique index if not exists purchases_payment_id_post_id_uniq
  on public.purchases (payment_id, post_id);

create index if not exists purchases_user_id_created_at_idx
  on public.purchases (user_id, created_at desc);

create index if not exists purchases_post_id_created_at_idx
  on public.purchases (post_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_id uuid,
  type text not null,
  message text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_is_read_idx
  on public.notifications (user_id, is_read);
