-- Tommy's Club: optional image attachments for chat messages.
-- Run once in the Supabase SQL editor before deploying the matching app code.

begin;

alter table public.messages
    add column if not exists image_url text,
    add column if not exists image_file_id text;

alter table public.messages
    alter column body drop not null;

alter table public.messages
    drop constraint if exists messages_body_check,
    drop constraint if exists messages_body_length_check,
    drop constraint if exists messages_image_url_length_check,
    drop constraint if exists messages_content_check;

alter table public.messages
    add constraint messages_body_length_check
        check (body is null or char_length(btrim(body)) between 1 and 2000),
    add constraint messages_image_url_length_check
        check (image_url is null or char_length(btrim(image_url)) between 1 and 2048),
    add constraint messages_content_check
        check (body is not null or image_url is not null);

commit;

-- Verification: both columns should exist and body should be nullable.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'messages'
  and column_name in ('body', 'image_url', 'image_file_id')
order by column_name;

-- Verification: the three named content constraints should be present.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.messages'::regclass
  and conname in (
      'messages_body_length_check',
      'messages_image_url_length_check',
      'messages_content_check'
  )
order by conname;

-- Verification: RLS remains enabled and existing policies are unchanged.
select relname, relrowsecurity
from pg_class
where oid = 'public.messages'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'messages'
order by policyname;
