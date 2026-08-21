-- Phase 9: security audit hardening. Every change below fixes a gap found by reading the live
-- RLS policies against real exploit scenarios (verified live afterward), not a hypothetical.

-- ---------------------------------------------------------------------------------------------
-- 1. [HIGH] Invitation-based privilege escalation to admin.
-- "Workspace members can create invitations" only required is_workspace_member(), not admin —
-- any member could INSERT an invitation with role='admin' (the column allows 'admin'|'member'
-- and nothing enforced role='member'), and accept_invitation() trusts inv.role verbatim when
-- creating the workspace_members row. The UI always sends role='member' and only shows the
-- invite button to admins, but the policy itself allowed any member to bypass that via a direct
-- insert. Invitations (of any role) are an admin capability per the app's own Settings/Dashboard
-- UI intent — require workspace-admin here to match.
drop policy if exists "Workspace members can create invitations" on public.invitations;
create policy "Workspace admins can create invitations"
on public.invitations
for insert
to authenticated
with check (public.is_workspace_admin(workspace_id) and invited_by = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 2. [HIGH] Workspace owner role tampering.
-- "Workspace admins can update member roles" restricted the new role value (WITH CHECK role <>
-- 'owner') but not which row could be targeted (USING had no such restriction) — any admin could
-- UPDATE the owner's own workspace_members row and demote them to 'member', silently stripping
-- their admin rights while the attacker keeps theirs. The DELETE policy right below it already
-- gets this right (USING checks role <> 'owner' too); this makes UPDATE consistent with it.
drop policy if exists "Workspace admins can update member roles" on public.workspace_members;
create policy "Workspace admins can update member roles"
on public.workspace_members
for update
to authenticated
using (public.is_workspace_admin(workspace_id) and role <> 'owner')
with check (public.is_workspace_admin(workspace_id) and role <> 'owner');

-- ---------------------------------------------------------------------------------------------
-- 3. [HIGH] Project/team membership grants to non-workspace-members.
-- "Project admins can add project members" / "Team admins can add team members" verified the
-- CALLER's admin standing but never checked that the person being ADDED is even a member of the
-- project's/team's workspace. Since is_project_member()/is_team_member() are what
-- has_project_access()/can_access_channel() ultimately trust, a project or team admin could grant
-- a complete outsider (any authenticated Supabase user, zero workspace relationship) real access
-- to that project's or team's tasks/files/channels — a workspace-isolation bypass. The app's own
-- UI only ever offers workspace members as candidates; this closes the gap at the data layer too.
-- New, separately-named helpers for "does a SPECIFIC (non-caller) user belong to this
-- workspace/have admin standing" — is_workspace_member()/is_workspace_admin() are single-argument
-- functions used throughout dozens of existing RLS policies; adding a defaulted second parameter
-- to them would create an overload ambiguous with every existing 1-argument call, and dropping the
-- originals to avoid that would cascade-delete every policy that references them. New names avoid
-- both problems entirely and leave every existing policy untouched.
create or replace function public.is_user_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = target_user_id
  );
$$;

create or replace function public.is_user_workspace_admin(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = target_user_id
      and role in ('owner', 'admin')
  );
$$;

drop policy if exists "Project admins can add project members" on public.project_members;
create policy "Project admins can add project members"
on public.project_members
for insert
to authenticated
with check (
  public.is_project_admin(project_id)
  and exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and public.is_user_workspace_member(p.workspace_id, user_id)
  )
);

drop policy if exists "Team admins can add team members" on public.team_members;
create policy "Team admins can add team members"
on public.team_members
for insert
to authenticated
with check (
  public.is_team_admin(team_id)
  and public.is_user_workspace_member(public.team_workspace_id(team_id), user_id)
);

-- ---------------------------------------------------------------------------------------------
-- 4. [MEDIUM] has_project_access() admin-bypass checked the wrong user.
-- Its admin-bypass branch called is_workspace_admin(p.workspace_id), a single-argument,
-- caller-relative check — so when has_project_access() was called with an explicit target_user_id
-- other than the caller (exactly what the tasks INSERT/UPDATE policies do to validate an
-- assignee), the branch evaluated whether the CALLER is an admin, not the assignee. A workspace
-- admin assigning a task to someone with no real project relationship would pass this check purely
-- because the admin themselves is an admin — producing an assignment the assignee can't actually
-- open, plus a task_assigned notification that leaks the task's title to them regardless. Fixed to
-- check the target user's standing via is_user_workspace_admin() from #3 above.
create or replace function public.has_project_access(target_project_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target_project_id
      and (
        public.is_user_workspace_admin(p.workspace_id, target_user_id)
        or public.is_project_member(target_project_id, target_user_id)
        or (p.team_id is not null and public.is_team_member_for(p.team_id, target_user_id))
      )
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. [MEDIUM] Notification spam/phishing to non-members.
-- "Workspace members can create notifications" checked that the SENDER (actor_id) is a workspace
-- member, but never that the RECIPIENT (user_id) is — and the notifications SELECT policy is
-- purely user_id = auth.uid(), with no workspace-membership check either. Combined, any workspace
-- member could insert a notification (title/message freely chosen) targeting ANY user account in
-- the system, not just people in that workspace — usable for spam/phishing and for revealing that
-- a given workspace_id/target_id exists to someone with no access to either.
drop policy if exists "Workspace members can create notifications" on public.notifications;
create policy "Workspace members can create notifications"
on public.notifications
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and actor_id = auth.uid()
  and public.is_user_workspace_member(workspace_id, user_id)
);

-- ---------------------------------------------------------------------------------------------
-- 6. [DATA INTEGRITY] Structural workspace-consistency enforcement.
-- Nothing previously stopped a client from inserting a task whose workspace_id didn't match its
-- project's real workspace (or a message whose workspace_id didn't match its channel's). Reads
-- were not actually exposed by this — every affected table's SELECT policy re-derives real access
-- through the parent (has_project_access(project_id), can_access_channel(channel_id)), not the
-- stored workspace_id column — but a mismatched workspace_id is still a structural integrity bug
-- (the exact "task belongs to Project A but points at Workspace B" scenario) and is corrected here
-- by deriving it server-side instead of trusting client input at all.
create or replace function public.derive_task_workspace_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select workspace_id into new.workspace_id from public.projects where id = new.project_id;
  return new;
end;
$$;

-- Fires on every update (not just when project_id changes) — otherwise a client could still
-- forge workspace_id directly via an update payload that leaves project_id untouched, since the
-- UPDATE RLS policy only re-validates project-based access, not which columns changed.
drop trigger if exists before_write_derive_task_workspace_id on public.tasks;
create trigger before_write_derive_task_workspace_id
  before insert or update on public.tasks
  for each row execute procedure public.derive_task_workspace_id();

create or replace function public.derive_message_workspace_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select workspace_id into new.workspace_id from public.channels where id = new.channel_id;
  return new;
end;
$$;

drop trigger if exists before_write_derive_message_workspace_id on public.messages;
create trigger before_write_derive_message_workspace_id
  before insert or update on public.messages
  for each row execute procedure public.derive_message_workspace_id();

-- files/channels/activity_logs carry multiple OPTIONAL parent tags rather than one required
-- parent, so instead of silently overriding workspace_id we reject inserts/updates where a
-- provided parent's real workspace disagrees with the row's own workspace_id.
create or replace function public.validate_workspace_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_workspace_id uuid;
begin
  if TG_TABLE_NAME = 'files' then
    if new.team_id is not null then
      select workspace_id into parent_workspace_id from public.teams where id = new.team_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'files.team_id does not belong to files.workspace_id';
      end if;
    end if;
    if new.project_id is not null then
      select workspace_id into parent_workspace_id from public.projects where id = new.project_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'files.project_id does not belong to files.workspace_id';
      end if;
    end if;
    if new.task_id is not null then
      select workspace_id into parent_workspace_id from public.tasks where id = new.task_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'files.task_id does not belong to files.workspace_id';
      end if;
    end if;
    if new.message_id is not null then
      select workspace_id into parent_workspace_id from public.messages where id = new.message_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'files.message_id does not belong to files.workspace_id';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'channels' then
    if new.team_id is not null then
      select workspace_id into parent_workspace_id from public.teams where id = new.team_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'channels.team_id does not belong to channels.workspace_id';
      end if;
    end if;
    if new.project_id is not null then
      select workspace_id into parent_workspace_id from public.projects where id = new.project_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'channels.project_id does not belong to channels.workspace_id';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'activity_logs' then
    if new.team_id is not null then
      select workspace_id into parent_workspace_id from public.teams where id = new.team_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'activity_logs.team_id does not belong to activity_logs.workspace_id';
      end if;
    end if;
    if new.project_id is not null then
      select workspace_id into parent_workspace_id from public.projects where id = new.project_id;
      if parent_workspace_id is distinct from new.workspace_id then
        raise exception 'activity_logs.project_id does not belong to activity_logs.workspace_id';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists before_write_validate_files_workspace on public.files;
create trigger before_write_validate_files_workspace
  before insert or update of workspace_id, team_id, project_id, task_id, message_id on public.files
  for each row execute procedure public.validate_workspace_consistency();

drop trigger if exists before_write_validate_channels_workspace on public.channels;
create trigger before_write_validate_channels_workspace
  before insert or update of workspace_id, team_id, project_id on public.channels
  for each row execute procedure public.validate_workspace_consistency();

drop trigger if exists before_write_validate_activity_logs_workspace on public.activity_logs;
create trigger before_write_validate_activity_logs_workspace
  before insert or update of workspace_id, team_id, project_id on public.activity_logs
  for each row execute procedure public.validate_workspace_consistency();
