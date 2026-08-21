-- Bug found via live testing: channel_members' INSERT policy queried "channels" directly (a
-- plain subquery, not through a security-definer function). A brand-new private channel isn't
-- visible under channels' own SELECT policy until the creator already has a channel_members row
-- — but that's exactly the row this policy is trying to authorize, so the creator could never
-- add themselves (or anyone else) to a private channel they just created. Same root cause as
-- migration 019 (RLS check needs to read data the caller can't yet SELECT), fixed the same way:
-- route the channels lookup through a security-definer function so it bypasses channels' RLS
-- for this specific, already-scoped authorization check.

create or replace function public.channel_member_insert_authorized(target_channel_id uuid, target_new_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1 from public.channels c
      where c.id = target_channel_id
        and public.is_workspace_member(c.workspace_id)
        and (c.created_by = auth.uid() or public.is_channel_member(c.id))
    )
    and exists (
      select 1 from public.channels c2
      join public.workspace_members wm on wm.workspace_id = c2.workspace_id
      where c2.id = target_channel_id and wm.user_id = target_new_member_id
    );
$$;

drop policy if exists "Channel creator or members can add channel members" on public.channel_members;
create policy "Channel creator or members can add channel members"
on public.channel_members
for insert
to authenticated
with check (public.channel_member_insert_authorized(channel_id, user_id));

drop function if exists public.debug_channel_member_insert_check(uuid, uuid);
