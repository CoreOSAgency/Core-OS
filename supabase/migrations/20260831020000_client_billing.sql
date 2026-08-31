-- Retainer + billing-event tracking per client. Manual entry in v1; the
-- `source` column and stripe_invoice_id leave room for a later Stripe sync.

create table if not exists public.client_billing (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  retainer_amount numeric(10,2),
  billing_frequency text check (billing_frequency in ('monthly', 'weekly', 'one_time', 'custom')),
  currency text not null default 'USD',
  billing_start_date date,
  minimum_term_months integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'invoiced', 'paid', 'overdue', 'void')),
  due_date date,
  paid_date date,
  description text,
  source text not null default 'manual' check (source in ('manual', 'stripe')),
  stripe_invoice_id text,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_project_idx
  on public.billing_events (project_id, due_date);

alter table public.client_billing enable row level security;
alter table public.billing_events enable row level security;

-- Ownership mirrors project_context: check projects.user_id via the join.
create policy "client_billing_select_own" on public.client_billing for select
  using (exists (select 1 from public.projects p
    where p.id = client_billing.project_id and p.user_id = auth.uid()));
create policy "client_billing_insert_own" on public.client_billing for insert
  with check (exists (select 1 from public.projects p
    where p.id = client_billing.project_id and p.user_id = auth.uid()));
create policy "client_billing_update_own" on public.client_billing for update
  using (exists (select 1 from public.projects p
    where p.id = client_billing.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p
    where p.id = client_billing.project_id and p.user_id = auth.uid()));
create policy "client_billing_delete_own" on public.client_billing for delete
  using (exists (select 1 from public.projects p
    where p.id = client_billing.project_id and p.user_id = auth.uid()));

create policy "billing_events_select_own" on public.billing_events for select
  using (exists (select 1 from public.projects p
    where p.id = billing_events.project_id and p.user_id = auth.uid()));
create policy "billing_events_insert_own" on public.billing_events for insert
  with check (exists (select 1 from public.projects p
    where p.id = billing_events.project_id and p.user_id = auth.uid()));
create policy "billing_events_update_own" on public.billing_events for update
  using (exists (select 1 from public.projects p
    where p.id = billing_events.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p
    where p.id = billing_events.project_id and p.user_id = auth.uid()));
create policy "billing_events_delete_own" on public.billing_events for delete
  using (exists (select 1 from public.projects p
    where p.id = billing_events.project_id and p.user_id = auth.uid()));
