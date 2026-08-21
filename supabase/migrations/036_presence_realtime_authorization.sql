-- [HIGH] Presence channel leaked workspace membership to any authenticated user.
-- subscribeToWorkspacePresence() joins a channel named "presence:<workspaceId>". postgres_changes
-- (messages/reactions/notifications) are backed by table RLS and were verified live to correctly
-- deny non-members — but Presence/Broadcast channels are a different Realtime primitive with no
-- table behind them at all, so by default ANY authenticated user who knows or guesses a
-- workspace_id can join that channel and see who else is present, regardless of whether they are
-- a member of that workspace. Verified live: an outsider joined presence:<workspaceId> for a
-- workspace they were never added to and received the real member's presence state.
--
-- Fixed using Supabase's Realtime Authorization: the channel is now created with
-- config.private = true (see presenceService.js), which routes join attempts through RLS on
-- realtime.messages instead of allowing anyone to join. This policy extracts the workspace id
-- from the topic ("presence:<uuid>") and requires real workspace membership.
create policy "Workspace members can join their workspace presence channel"
on "realtime"."messages"
for select
to authenticated
using (
  realtime.topic() like 'presence:%'
  and public.is_workspace_member((split_part(realtime.topic(), ':', 2))::uuid)
);

-- Presence tracking (channel.track()) sends the client's own presence payload through the same
-- private channel, which Realtime Authorization treats as a write — same topic-based check.
create policy "Workspace members can update presence on their workspace channel"
on "realtime"."messages"
for insert
to authenticated
with check (
  realtime.topic() like 'presence:%'
  and public.is_workspace_member((split_part(realtime.topic(), ':', 2))::uuid)
);
