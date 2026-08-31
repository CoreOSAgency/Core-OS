-- Track what actually happened per message once agents can answer in one of
-- three modes (quick / standard / deep): the mode requested, the Gemini model
-- that ended up answering (may differ from requested if a fallback fired),
-- the thinking depth, and any web-grounding sources the model cited.
alter table public.messages
  add column if not exists mode text default 'standard' check (mode in ('quick', 'standard', 'deep')),
  add column if not exists model_used text,
  add column if not exists thinking_level text,
  add column if not exists grounding_sources jsonb default '[]'::jsonb;
