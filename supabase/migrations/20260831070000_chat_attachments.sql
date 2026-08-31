-- Composer upgrade: file + voice attachments on chat messages.

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- Path convention: {user_id}/{filename}. RLS checks the first segment.
create policy "chat_attachments_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- [{ storage_path, mime_type, file_name }] per message, for re-display.
alter table public.messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
