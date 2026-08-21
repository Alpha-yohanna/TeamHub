-- These ten tables exist on the remote database but were never created by any migration in
-- this history, are referenced by zero application code across Phases 1-3, hold zero rows, and
-- carry no RLS policies at all (RLS-enabled with no policies means fully inaccessible).
-- Investigated and confirmed empty/unused before dropping (see Phase 4 discussion) — this
-- clears the way for a properly designed, migration-tracked projects/tasks schema.
drop table if exists public.event_participants cascade;
drop table if exists public.calendar_events cascade;
drop table if exists public.direct_conversation_members cascade;
drop table if exists public.direct_conversations cascade;
drop table if exists public.task_comments cascade;
drop table if exists public.tasks cascade;
drop table if exists public.projects cascade;
drop table if exists public.folders cascade;
drop table if exists public.saved_items cascade;
drop table if exists public.user_preferences cascade;
