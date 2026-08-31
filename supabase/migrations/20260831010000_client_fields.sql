-- Structured client/commercial fields on projects (the client entity).
-- Brand colours/logo/tone stay in project_context (free-text, agent-facing);
-- only fields that billing/domains/reporting need to filter, sum, or join on
-- get real columns here.
alter table public.projects
  add column if not exists industry text,
  add column if not exists website_url text,
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_email text,
  add column if not exists status text not null default 'active'
    check (status in ('lead', 'onboarding', 'active', 'paused', 'churned')),
  add column if not exists archived_at timestamptz;

create index if not exists projects_user_status_idx
  on public.projects (user_id, status);
