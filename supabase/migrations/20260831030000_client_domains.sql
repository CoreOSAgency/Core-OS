-- Domains a client already owns, connected to CoreOS via DNS-TXT or
-- file-upload verification. Not a registrar — no domain purchase here.

create table if not exists public.client_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  domain text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  verification_method text, -- 'dns_txt' | 'file_upload'
  verification_token text,
  connected boolean not null default false,
  dns_provider text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, domain)
);

alter table public.client_domains enable row level security;

-- Ownership mirrors project_context / client_billing: projects.user_id via join.
create policy "client_domains_select_own" on public.client_domains for select
  using (exists (select 1 from public.projects p
    where p.id = client_domains.project_id and p.user_id = auth.uid()));
create policy "client_domains_insert_own" on public.client_domains for insert
  with check (exists (select 1 from public.projects p
    where p.id = client_domains.project_id and p.user_id = auth.uid()));
create policy "client_domains_update_own" on public.client_domains for update
  using (exists (select 1 from public.projects p
    where p.id = client_domains.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p
    where p.id = client_domains.project_id and p.user_id = auth.uid()));
create policy "client_domains_delete_own" on public.client_domains for delete
  using (exists (select 1 from public.projects p
    where p.id = client_domains.project_id and p.user_id = auth.uid()));
