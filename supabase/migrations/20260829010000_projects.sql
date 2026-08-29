-- Projects: the unit every agent conversation is now scoped to.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Project-scoped memory (supersedes the old user-scoped agency_context for
-- prompt injection — that table is left in place, unused, rather than
-- deleted, since dropping it isn't necessary for this to work).
create table if not exists public.project_context (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);

alter table public.project_context enable row level security;

create policy "project_context_select_own"
  on public.project_context for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_context.project_id and p.user_id = auth.uid()
  ));

create policy "project_context_insert_own"
  on public.project_context for insert
  with check (exists (
    select 1 from public.projects p
    where p.id = project_context.project_id and p.user_id = auth.uid()
  ));

create policy "project_context_update_own"
  on public.project_context for update
  using (exists (
    select 1 from public.projects p
    where p.id = project_context.project_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_context.project_id and p.user_id = auth.uid()
  ));

create policy "project_context_delete_own"
  on public.project_context for delete
  using (exists (
    select 1 from public.projects p
    where p.id = project_context.project_id and p.user_id = auth.uid()
  ));
