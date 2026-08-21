-- Tables aren't broadcast over Supabase Realtime until explicitly added to this publication;
-- without it, postgres_changes subscriptions silently receive nothing even though the insert
-- succeeds and RLS is satisfied.
alter publication supabase_realtime add table public.messages;
