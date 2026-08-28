-- Per-user key/value memory the agents read from and write to across
-- conversations (any agent, not just the one that learned the fact).
create table if not exists public.agency_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.agency_context enable row level security;

create policy "agency_context_select_own"
  on public.agency_context for select
  using (auth.uid() = user_id);

create policy "agency_context_insert_own"
  on public.agency_context for insert
  with check (auth.uid() = user_id);

create policy "agency_context_update_own"
  on public.agency_context for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "agency_context_delete_own"
  on public.agency_context for delete
  using (auth.uid() = user_id);
