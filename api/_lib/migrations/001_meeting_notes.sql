-- Meeting Notes Warehouse — initial schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run multiple times (all statements use IF NOT EXISTS / OR REPLACE).

create extension if not exists "uuid-ossp";

create table if not exists meeting_notes (
  id                uuid          primary key default uuid_generate_v4(),
  external_id       text,
  source            text          not null default 'spellar',
  title             text          not null,
  meeting_type      text,
  person_names      text[],
  attendee_emails   text[],
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_minutes  integer,
  summary           text,
  transcript        text,
  action_items      jsonb,
  decisions         jsonb,
  tags              text[],
  raw_payload       jsonb         not null,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

-- Unique constraint on external_id to support idempotent upserts.
-- Partial index so multiple NULLs are still allowed.
create unique index if not exists meeting_notes_external_id_uidx
  on meeting_notes (external_id)
  where external_id is not null;

-- Ordering / filtering indexes
create index if not exists meeting_notes_started_at_idx
  on meeting_notes (started_at desc nulls last);

create index if not exists meeting_notes_meeting_type_idx
  on meeting_notes (meeting_type)
  where meeting_type is not null;

create index if not exists meeting_notes_source_idx
  on meeting_notes (source);

-- Full-text search index across title, summary, and transcript
create index if not exists meeting_notes_fts_idx
  on meeting_notes using gin (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(transcript, '')
    )
  );

-- Auto-update updated_at on every row modification
create or replace function update_meeting_notes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists meeting_notes_set_updated_at on meeting_notes;
create trigger meeting_notes_set_updated_at
  before update on meeting_notes
  for each row execute function update_meeting_notes_updated_at();
