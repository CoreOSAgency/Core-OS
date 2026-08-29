-- OAuth tokens for third-party integrations (Google Drive first).
create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_integrations enable row level security;

create policy "user_integrations_select_own"
  on public.user_integrations for select
  using (auth.uid() = user_id);

create policy "user_integrations_insert_own"
  on public.user_integrations for insert
  with check (auth.uid() = user_id);

create policy "user_integrations_update_own"
  on public.user_integrations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_integrations_delete_own"
  on public.user_integrations for delete
  using (auth.uid() = user_id);
