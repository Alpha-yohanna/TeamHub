-- Phase 3: teams become real collaboration spaces — a single enforced team lead, team-scoped
-- channels/files/activity, and member management that's actually possible (team_members had
-- no update/delete policy at all before this).

alter table public.teams add column if not exists icon text;
alter table public.profiles add column if not exists email text;

-- Workspace-mates can already see each other's name/username/avatar (migration 008); email is
-- the same trust boundary (shared workspace), and Phase 3 needs it on team member rows.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  base_username text;
  new_username text;
  new_workspace_id uuid;
  base_slug text;
  new_slug text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]+', '-', 'gi'));
  new_username := base_username || '-' || substr(new.id::text, 1, 6);

  insert into public.profiles (id, full_name, username, avatar_url, role, status, bio, email)
  values (new.id, display_name, new_username, null, 'owner', 'online', null, new.email);

  base_slug := new_username || '-workspace';
  new_slug := base_slug;

  insert into public.workspaces (name, slug, description, owner_id)
  values (display_name || '''s Workspace', new_slug, 'Default workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

-- Team-scoped authorization helpers, same security-definer pattern as the rest of the schema.
create or replace function public.team_workspace_id(target_team_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.teams where id = target_team_id;
$$;

create or replace function public.is_team_lead(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and role = 'lead'
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_workspace_admin(public.team_workspace_id(target_team_id))
    or public.is_team_lead(target_team_id);
$$;

-- Channels can now belong to a team; this must exist before can_access_channel() references it.
alter table public.channels add column if not exists team_id uuid references public.teams(id) on delete cascade;
create index if not exists channels_team_id_idx on public.channels (team_id);

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
      and (c.team_id is null or public.is_team_member(c.team_id))
  );
$$;

-- Team creation narrows from "any workspace member" to "workspace admins/owners" (spec 1).
drop policy if exists "Workspace members can create teams" on public.teams;
create policy "Workspace admins can create teams"
on public.teams
for insert
to authenticated
with check (public.is_workspace_admin(workspace_id) and created_by = auth.uid());

create policy "Team admins can update team"
on public.teams
for update
to authenticated
using (public.is_workspace_admin(workspace_id) or public.is_team_lead(id))
with check (public.is_workspace_admin(workspace_id) or public.is_team_lead(id));

grant update on public.teams to authenticated;

-- Member management narrows from "any workspace member" to "team admins/leads" (spec 6),
-- and removal becomes possible at all (no delete policy existed before).
drop policy if exists "Workspace members can add team members" on public.team_members;
create policy "Team admins can add team members"
on public.team_members
for insert
to authenticated
with check (public.is_team_admin(team_id));

create policy "Team admins can remove team members"
on public.team_members
for delete
to authenticated
using (public.is_team_admin(team_id));

grant delete on public.team_members to authenticated;

-- Exactly one lead per team, enforced at the database level, not just in application logic.
create unique index if not exists team_members_one_lead_per_team
on public.team_members (team_id)
where (role = 'lead');

-- Lead reassignment is workspace admin/owner only (spec 3) — no client-side update policy on
-- team_members exists at all, so this security-definer RPC is the only path that can change a
-- role, and it enforces that restriction itself rather than trusting the frontend.
create or replace function public.set_team_lead(target_team_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  target_workspace_id := public.team_workspace_id(target_team_id);
  if target_workspace_id is null then
    raise exception 'Team not found';
  end if;

  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Only workspace admins or owners can assign a team lead';
  end if;

  if not exists (
    select 1 from public.team_members where team_id = target_team_id and user_id = target_user_id
  ) then
    raise exception 'User must already be a team member';
  end if;

  update public.team_members set role = 'member' where team_id = target_team_id and role = 'lead';
  update public.team_members set role = 'lead' where team_id = target_team_id and user_id = target_user_id;
end;
$$;

grant execute on function public.set_team_lead(uuid, uuid) to authenticated;

-- A team channel is only visible/creatable by team members; workspace-wide channels
-- (team_id null) keep their existing behavior unchanged.
drop policy if exists "Workspace members can view channels" on public.channels;
create policy "Workspace members can view accessible channels"
on public.channels
for select
to authenticated
using (public.is_workspace_member(workspace_id) and (team_id is null or public.is_team_member(team_id)));

drop policy if exists "Workspace members can create channels" on public.channels;
create policy "Workspace members can create accessible channels"
on public.channels
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
  and (team_id is null or public.is_team_member(team_id))
);

-- Messages previously only checked workspace membership, which would leak team-private channel
-- content to any workspace member once team channels exist. Tighten to per-channel access.
drop policy if exists "Workspace members can view messages" on public.messages;
create policy "Members can view accessible channel messages"
on public.messages
for select
to authenticated
using (public.can_access_channel(channel_id));

drop policy if exists "Workspace members can send messages" on public.messages;
create policy "Members can send to accessible channels"
on public.messages
for insert
to authenticated
with check (public.can_access_channel(channel_id) and sender_id = auth.uid());

-- Files and activity log entries can optionally be tagged with a team for display/filtering.
-- Per spec, existing workspace-wide access policies are left as-is (not narrowed further).
alter table public.files add column if not exists team_id uuid references public.teams(id) on delete set null;
create index if not exists files_team_id_idx on public.files (team_id);

alter table public.activity_logs add column if not exists team_id uuid references public.teams(id) on delete set null;
create index if not exists activity_logs_team_id_idx on public.activity_logs (team_id);
