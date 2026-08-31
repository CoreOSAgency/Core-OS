-- Phase 9: a conversation can hold more than one agent.

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  agent_id text not null,
  added_at timestamptz not null default now(),
  unique (conversation_id, agent_id)
);
alter table public.conversation_participants enable row level security;

create policy "conversation_participants_select_own"
  on public.conversation_participants for select
  using (exists (
    select 1 from public.conversations c
    join public.projects p on p.id = c.project_id
    where c.id = conversation_participants.conversation_id and p.user_id = auth.uid()
  ));
create policy "conversation_participants_insert_own"
  on public.conversation_participants for insert
  with check (exists (
    select 1 from public.conversations c
    join public.projects p on p.id = c.project_id
    where c.id = conversation_participants.conversation_id and p.user_id = auth.uid()
  ));
create policy "conversation_participants_delete_own"
  on public.conversation_participants for delete
  using (exists (
    select 1 from public.conversations c
    join public.projects p on p.id = c.project_id
    where c.id = conversation_participants.conversation_id and p.user_id = auth.uid()
  ));

-- Every existing conversation's sole agent becomes its sole participant.
insert into public.conversation_participants (conversation_id, agent_id)
select id, agent_id from public.conversations
on conflict (conversation_id, agent_id) do nothing;

-- Each model message records which agent said it. Nullable: user-role rows
-- have none, and existing model rows are backfilled.
alter table public.messages add column if not exists agent_id text;

update public.messages m
set agent_id = c.agent_id
from public.conversations c
where m.conversation_id = c.id and m.role = 'model' and m.agent_id is null;
