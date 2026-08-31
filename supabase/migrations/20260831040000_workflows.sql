-- Persisted agent workflows (the React Flow canvas) and their run history.
-- Replaces the localStorage-only canvas so workflows survive reloads and can
-- be executed server-side.

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  definition jsonb not null, -- serialized nodes/edges from the React Flow canvas
  is_active boolean not null default false,
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'schedule', 'webhook')),
  trigger_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflows_user_idx
  on public.workflows (user_id, updated_at desc);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  step_results jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists workflow_runs_workflow_idx
  on public.workflow_runs (workflow_id, started_at desc);

alter table public.workflows enable row level security;
alter table public.workflow_runs enable row level security;

-- workflows: owner-scoped, same shape as user_integrations.
create policy "workflows_select_own" on public.workflows for select
  using (auth.uid() = user_id);
create policy "workflows_insert_own" on public.workflows for insert
  with check (auth.uid() = user_id);
create policy "workflows_update_own" on public.workflows for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workflows_delete_own" on public.workflows for delete
  using (auth.uid() = user_id);

-- workflow_runs: ownership via the workflows join.
create policy "workflow_runs_select_own" on public.workflow_runs for select
  using (exists (select 1 from public.workflows w
    where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()));
create policy "workflow_runs_insert_own" on public.workflow_runs for insert
  with check (exists (select 1 from public.workflows w
    where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()));
create policy "workflow_runs_update_own" on public.workflow_runs for update
  using (exists (select 1 from public.workflows w
    where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workflows w
    where w.id = workflow_runs.workflow_id and w.user_id = auth.uid()));
