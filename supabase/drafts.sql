-- Drafts table for storing AI agent outputs
-- Run this in Supabase SQL Editor

create table if not exists drafts (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  source text not null default 'agents',
  meta jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for efficient queries
create index if not exists drafts_created_at_idx on drafts (created_at desc);
create index if not exists drafts_source_idx on drafts (source);

-- Comment
comment on table drafts is 'AI agent generated drafts for X posts';
