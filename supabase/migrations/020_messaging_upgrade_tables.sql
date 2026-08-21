-- Phase 5: Messages & Real-Time Collaboration. Extends the existing channels/messages tables
-- rather than building a parallel "conversations" system — a DM or group conversation is just a
-- channel with type='dm'/'group' and explicit channel_members, reusing the same messages table,
-- realtime publication, and (via ChannelPanel) the same UI already used for team/project
-- channels. Table DDL only in this migration; policies/functions that cross-reference these
-- tables land in 021, applied as a separate migration (lesson from Phase 4: a table's own
-- policy must never re-query that same table through a function, or RETURNING-time visibility
-- checks can fail unpredictably — keeping DDL and policies in separate migrations sidesteps a
-- different but related same-statement visibility hazard).

create extension if not exists pg_trgm;

alter table public.channels add column if not exists type text not null default 'channel' check (type in ('channel', 'dm', 'group'));
alter table public.channels add column if not exists is_private boolean not null default false;
alter table public.channels add column if not exists last_message_at timestamptz;
alter table public.channels alter column name drop not null;

create table if not exists public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

alter table public.messages add column if not exists parent_message_id uuid references public.messages(id) on delete cascade;
alter table public.messages add column if not exists reply_count integer not null default 0;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;

create index if not exists messages_parent_message_id_idx on public.messages (parent_message_id);
create index if not exists messages_content_trgm_idx on public.messages using gin (content gin_trgm_ops);
create index if not exists channels_last_message_at_idx on public.channels (last_message_at);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create table if not exists public.message_mentions (
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (message_id, mentioned_user_id)
);

create table if not exists public.channel_reads (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

alter table public.files add column if not exists message_id uuid references public.messages(id) on delete cascade;
create index if not exists files_message_id_idx on public.files (message_id);

-- Keep channels.last_message_at and messages.reply_count in sync without extra client round
-- trips. security definer because a regular member has no UPDATE grant on channels/messages
-- otherwise.
create or replace function public.touch_channel_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.channels set last_message_at = new.created_at where id = new.channel_id;
  if new.parent_message_id is not null then
    update public.messages set reply_count = reply_count + 1 where id = new.parent_message_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_message_insert_touch_channel on public.messages;
create trigger on_message_insert_touch_channel
  after insert on public.messages
  for each row execute procedure public.touch_channel_on_new_message();

alter table public.channel_members enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_mentions enable row level security;
alter table public.channel_reads enable row level security;
