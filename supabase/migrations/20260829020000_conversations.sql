-- Persistent chat threads per (project, agent), so switching agents or
-- reloading doesn't lose history, and users can browse/resume past chats.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_project_agent_idx
  on public.conversations (project_id, agent_id, updated_at desc);

alter table public.conversations enable row level security;

create policy "conversations_select_own"
  on public.conversations for select
  using (exists (
    select 1 from public.projects p
    where p.id = conversations.project_id and p.user_id = auth.uid()
  ));

create policy "conversations_insert_own"
  on public.conversations for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = conversations.project_id and p.user_id = auth.uid()
  ));

create policy "conversations_update_own"
  on public.conversations for update
  using (exists (
    select 1 from public.projects p
    where p.id = conversations.project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = conversations.project_id and p.user_id = auth.uid()
  ));

create policy "conversations_delete_own"
  on public.conversations for delete
  using (exists (
    select 1 from public.projects p
    where p.id = conversations.project_id and p.user_id = auth.uid()
  ));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  context_saved boolean not null default false,
  is_deliverable boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "messages_select_own"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    join public.projects p on p.id = c.project_id
    where c.id = messages.conversation_id and p.user_id = auth.uid()
  ));

create policy "messages_insert_own"
  on public.messages for insert
  with check (exists (
    select 1 from public.conversations c
    join public.projects p on p.id = c.project_id
    where c.id = messages.conversation_id and p.user_id = auth.uid()
  ));

create policy "messages_delete_own"
  on public.messages for delete
  using (exists (
    select 1 from public.conversations c
    join public.projects p on p.id = c.project_id
    where c.id = messages.conversation_id and p.user_id = auth.uid()
  ));
