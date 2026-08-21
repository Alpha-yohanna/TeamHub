-- Removes the throwaway diagnostic function used to isolate a test-script-only RLS/RETURNING
-- artifact during Phase 9 verification (chaining .select() after inserting a notification for
-- someone other than the caller hits Postgres's RETURNING-visibility check against the
-- recipient-only SELECT policy — the real app's createNotification() never chains .select(), so
-- it was never affected). Not needed going forward.
drop function if exists public.debug_notif_check(uuid, uuid, uuid);
