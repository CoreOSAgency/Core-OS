-- Generated slide images live in Storage, not inline in decks.model - a deck
-- with 6 AI images would be a multi-MB jsonb row the public viewer re-downloads
-- on every load. Public-read bucket (the deck viewer is already public).

insert into storage.buckets (id, name, public)
values ('deck-assets', 'deck-assets', true)
on conflict (id) do nothing;

drop policy if exists "deck_assets_public_read" on storage.objects;
create policy "deck_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'deck-assets');

drop policy if exists "deck_assets_auth_write" on storage.objects;
create policy "deck_assets_auth_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'deck-assets');
