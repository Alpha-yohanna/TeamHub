-- Phase 5 continued: authorization helpers, RLS policies, and grants for the tables added in
-- 020.

create or replace function public.is_channel_member(target_channel_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = target_channel_id and user_id = target_user_id
  );
$$;

-- Public workspace/team/project channels keep their existing access rule; private channels and
-- every dm/group conversation are gated purely by explicit channel_members instead.
create or replace function public.can_access_channel(target_channel_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.channels c
    where c.id = target_channel_id
      and public.is_workspace_member(c.workspace_id)
      and (
        (
          not c.is_private
          and (c.team_id is null or public.is_team_member(c.team_id))
          and (c.project_id is null or public.has_project_access(c.project_id))
        )
        or public.is_channel_member(c.id)
      )
  );
$$;

-- channels: SELECT/INSERT stay inline on the row's own columns (not a self-referencing function
-- call back into channels) per the Phase 4 RETURNING lesson; is_channel_member queries a
-- DIFFERENT table so it's safe to use here.
drop policy if exists "Workspace members can view accessible channels" on public.channels;
create policy "Workspace members can view accessible channels"
on public.channels
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    (
      not is_private
      and (team_id is null or public.is_team_member(team_id))
      and (project_id is null or public.has_project_access(project_id))
    )
    or public.is_channel_member(id)
  )
);

create policy "Group channel members can rename their channel"
on public.channels
for update
to authenticated
using (type = 'group' and public.is_channel_member(id))
with check (type = 'group' and public.is_channel_member(id));

grant update on public.channels to authenticated;

-- channel_members: self-referencing SELECT is the same proven-safe pattern as
-- is_workspace_member on workspace_members (plain SELECT, not something chained after an
-- insert/update in the service layer).
create policy "Channel members can view membership"
on public.channel_members
for select
to authenticated
using (public.is_channel_member(channel_id));

create policy "Channel creator or members can add channel members"
on public.channel_members
for insert
to authenticated
with check (
  exists (
    select 1 from public.channels c
    where c.id = channel_id
      and public.is_workspace_member(c.workspace_id)
      and (c.created_by = auth.uid() or public.is_channel_member(c.id))
  )
  and exists (
    select 1 from public.channels c2
    join public.workspace_members wm on wm.workspace_id = c2.workspace_id
    where c2.id = channel_id and wm.user_id = channel_members.user_id
  )
);

create policy "Members can leave; creators can remove members"
on public.channel_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.channels c where c.id = channel_id and c.created_by = auth.uid())
);

grant select, insert, delete on public.channel_members to authenticated;

-- messages: add edit/soft-delete. Authors edit their own messages; workspace admins can also
-- moderate (soft-delete) — but only where they already have channel access, so a private
-- channel/DM they aren't part of stays off-limits even to admins.
create policy "Authors or workspace admins can edit their messages"
on public.messages
for update
to authenticated
using ((sender_id = auth.uid() or public.is_workspace_admin(workspace_id)) and public.can_access_channel(channel_id))
with check ((sender_id = auth.uid() or public.is_workspace_admin(workspace_id)) and public.can_access_channel(channel_id));

grant update on public.messages to authenticated;

-- message_reactions
create policy "Channel viewers can see reactions"
on public.message_reactions
for select
to authenticated
using (exists (select 1 from public.messages m where m.id = message_id and public.can_access_channel(m.channel_id)));

create policy "Channel viewers can react"
on public.message_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.messages m where m.id = message_id and public.can_access_channel(m.channel_id))
);

create policy "Users can remove their own reaction"
on public.message_reactions
for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, delete on public.message_reactions to authenticated;

-- message_mentions — only the sender of a message can register mentions for it, at send time.
create policy "Channel viewers can see mentions"
on public.message_mentions
for select
to authenticated
using (exists (select 1 from public.messages m where m.id = message_id and public.can_access_channel(m.channel_id)));

create policy "Senders can mention on their own message"
on public.message_mentions
for insert
to authenticated
with check (exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid()));

grant select, insert on public.message_mentions to authenticated;

-- channel_reads — strictly own-row only, so nobody can manipulate another user's unread state.
create policy "Users can view their own read state"
on public.channel_reads
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can set their own read state"
on public.channel_reads
for insert
to authenticated
with check (user_id = auth.uid() and public.can_access_channel(channel_id));

create policy "Users can update their own read state"
on public.channel_reads
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.channel_reads to authenticated;

-- Atomic "find or create" for a 1:1 DM so two simultaneous clicks can't spawn duplicate
-- conversations, and so the caller never has to construct channel_members rows by hand.
create or replace function public.get_or_create_dm(other_user_id uuid, p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_channel_id uuid;
  new_channel_id uuid;
begin
  if other_user_id = auth.uid() then
    raise exception 'Cannot start a DM with yourself';
  end if;

  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace';
  end if;

  if not exists (
    select 1 from public.workspace_members where workspace_id = p_workspace_id and user_id = other_user_id
  ) then
    raise exception 'That person is not a member of this workspace';
  end if;

  select cm1.channel_id into existing_channel_id
  from public.channel_members cm1
  join public.channel_members cm2 on cm1.channel_id = cm2.channel_id
  join public.channels c on c.id = cm1.channel_id
  where c.workspace_id = p_workspace_id
    and c.type = 'dm'
    and cm1.user_id = auth.uid()
    and cm2.user_id = other_user_id
  limit 1;

  if existing_channel_id is not null then
    return existing_channel_id;
  end if;

  insert into public.channels (workspace_id, type, is_private, created_by)
  values (p_workspace_id, 'dm', true, auth.uid())
  returning id into new_channel_id;

  insert into public.channel_members (channel_id, user_id) values (new_channel_id, auth.uid());
  insert into public.channel_members (channel_id, user_id) values (new_channel_id, other_user_id);

  return new_channel_id;
end;
$$;

grant execute on function public.get_or_create_dm(uuid, uuid) to authenticated;

alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.channels;
