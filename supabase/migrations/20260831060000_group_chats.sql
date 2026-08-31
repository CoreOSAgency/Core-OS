-- Phase 9.1: group chats. A conversation is either a 1:1 with one agent
-- ('agent', the default, unchanged) or a named multi-agent room ('group',
-- agent_id null - membership lives entirely in conversation_participants).

alter table public.conversations
  add column if not exists kind text not null default 'agent'
    check (kind in ('agent', 'group'));

alter table public.conversations alter column agent_id drop not null;

create index if not exists conversations_project_kind_idx
  on public.conversations (project_id, kind, updated_at desc);
