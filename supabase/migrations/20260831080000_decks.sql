-- Phase 13: decks are now live HTML pages at a shareable URL, not .pptx files.
-- The resolved DeckModel (heading/bullets/colours/logo/images) is stored as
-- jsonb; the public viewer route looks a deck up by share_token via a
-- service-role query, so share_token is a separate random value from the PK.

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  model jsonb not null,
  title text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists decks_share_token_idx on public.decks (share_token);
create index if not exists decks_project_id_idx on public.decks (project_id);

alter table public.decks enable row level security;

-- Authenticated access (create / list / regenerate) is owner-scoped through
-- the parent project. The public viewer does NOT use this - it reads by
-- share_token with the service-role key, outside RLS.
create policy "decks_owner_all"
  on public.decks for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = decks.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = decks.project_id and p.user_id = auth.uid()
    )
  );
