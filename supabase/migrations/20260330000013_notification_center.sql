create table if not exists public.notification_threads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null default 'support',
  subject text not null default '',
  status text not null default 'open',
  source_type text,
  source_id uuid,
  allow_user_reply boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  last_admin_user_id uuid references auth.users(id) on delete set null,
  last_message_preview text not null default '',
  last_sender_role text not null default 'system',
  last_message_at timestamptz not null default now(),
  user_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (topic in ('support', 'author_application', 'withdrawal', 'moderation', 'system')),
  check (status in ('open', 'closed')),
  check (last_sender_role in ('user', 'admin', 'system'))
);

create index if not exists notification_threads_user_id_last_message_idx
  on public.notification_threads (user_id, last_message_at desc);

create index if not exists notification_threads_status_last_message_idx
  on public.notification_threads (status, last_message_at desc);

create unique index if not exists notification_threads_user_source_open_uniq
  on public.notification_threads (user_id, source_type, source_id)
  where source_type is not null and source_id is not null and status = 'open';

create table if not exists public.notification_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references public.notification_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (sender_role in ('user', 'admin', 'system')),
  check (char_length(trim(body)) > 0)
);

create index if not exists notification_messages_thread_id_created_at_idx
  on public.notification_messages (thread_id, created_at asc);

alter table public.notification_threads enable row level security;
alter table public.notification_messages enable row level security;

drop policy if exists "notification_threads_select_own" on public.notification_threads;
create policy "notification_threads_select_own"
  on public.notification_threads
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_messages_select_own_thread" on public.notification_messages;
create policy "notification_messages_select_own_thread"
  on public.notification_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.notification_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "notification_messages_insert_user_reply" on public.notification_messages;
create policy "notification_messages_insert_user_reply"
  on public.notification_messages
  for insert
  to authenticated
  with check (
    sender_role = 'user'
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.notification_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
        and t.status = 'open'
        and t.allow_user_reply = true
    )
  );
