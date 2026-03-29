create table if not exists public.post_meta (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  meta_key text not null,
  meta_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, meta_key)
);

create index if not exists post_meta_post_id_idx on public.post_meta (post_id);
create index if not exists post_meta_key_idx on public.post_meta (meta_key);

alter table public.post_meta enable row level security;

drop policy if exists "post_meta_select_own" on public.post_meta;
create policy "post_meta_select_own"
on public.post_meta
for select
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_meta.post_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "post_meta_insert_own" on public.post_meta;
create policy "post_meta_insert_own"
on public.post_meta
for insert
with check (
  exists (
    select 1
    from public.posts p
    where p.id = post_meta.post_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "post_meta_update_own" on public.post_meta;
create policy "post_meta_update_own"
on public.post_meta
for update
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_meta.post_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.posts p
    where p.id = post_meta.post_id
      and p.user_id = auth.uid()
  )
);

create table if not exists public.media (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  album_id uuid references public.albums(id) on delete set null,
  kind text not null,
  storage_bucket text not null,
  storage_path text not null,
  original_bucket text,
  original_path text,
  preview_bucket text,
  preview_path text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric(12,3),
  position integer not null default 0,
  visibility text not null default 'private',
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind in ('image', 'video', 'audio', 'file')),
  check (size_bytes is null or size_bytes >= 0),
  check (width is null or width > 0),
  check (height is null or height > 0),
  check (duration_seconds is null or duration_seconds >= 0),
  check (position >= 0),
  check (visibility in ('private', 'preview', 'public')),
  check (status in ('draft', 'processing', 'ready', 'failed', 'removed')),
  unique (storage_bucket, storage_path)
);

create index if not exists media_user_id_idx on public.media (user_id);
create index if not exists media_post_id_idx on public.media (post_id);
create index if not exists media_album_id_idx on public.media (album_id);
create index if not exists media_kind_idx on public.media (kind);

alter table public.media enable row level security;

drop policy if exists "media_select_own" on public.media;
create policy "media_select_own"
on public.media
for select
using (auth.uid() = user_id);

drop policy if exists "media_insert_own" on public.media;
create policy "media_insert_own"
on public.media
for insert
with check (auth.uid() = user_id);

drop policy if exists "media_update_own" on public.media;
create policy "media_update_own"
on public.media
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.media_meta (
  id uuid primary key default uuid_generate_v4(),
  media_id uuid not null references public.media(id) on delete cascade,
  meta_key text not null,
  meta_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_id, meta_key)
);

create index if not exists media_meta_media_id_idx on public.media_meta (media_id);
create index if not exists media_meta_key_idx on public.media_meta (meta_key);

alter table public.media_meta enable row level security;

drop policy if exists "media_meta_select_own" on public.media_meta;
create policy "media_meta_select_own"
on public.media_meta
for select
using (
  exists (
    select 1
    from public.media m
    where m.id = media_meta.media_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "media_meta_insert_own" on public.media_meta;
create policy "media_meta_insert_own"
on public.media_meta
for insert
with check (
  exists (
    select 1
    from public.media m
    where m.id = media_meta.media_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "media_meta_update_own" on public.media_meta;
create policy "media_meta_update_own"
on public.media_meta
for update
using (
  exists (
    select 1
    from public.media m
    where m.id = media_meta.media_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.media m
    where m.id = media_meta.media_id
      and m.user_id = auth.uid()
  )
);
