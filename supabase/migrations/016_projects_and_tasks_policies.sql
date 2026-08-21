-- Phase 4 continued: authorization helpers, RLS policies, and grants for the tables created in
-- 014, plus extending channels/files/activity_logs with an optional project_id.

-- Explicit two-arg variant alongside the existing single-arg is_team_member(uuid) (kept
-- untouched — channels/messages RLS already depends on it) so assignee eligibility can be
-- checked for a user who is not the calling session.
create or replace function public.is_team_member_for(target_team_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and user_id = target_user_id
  );
$$;

create or replace function public.is_project_member(target_project_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project_id and user_id = target_user_id
  );
$$;

-- A project is visible to workspace admins, anyone explicitly added to it, and — if it's
-- assigned to a team — every member of that team (mirrors how team channels work).
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
        public.is_workspace_admin(p.workspace_id)
        or public.is_project_member(target_project_id, target_user_id)
        or (p.team_id is not null and public.is_team_member_for(p.team_id, target_user_id))
      )
  );
$$;

-- Project management (edit/status/archive/members) is workspace admins, the project's own
-- owner, or the lead of the team it's assigned to.
create or replace function public.is_project_admin(target_project_id uuid)
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
        public.is_workspace_admin(p.workspace_id)
        or p.owner_id = auth.uid()
        or (p.team_id is not null and public.is_team_lead(p.team_id))
      )
  );
$$;

create or replace function public.can_access_task(target_task_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task_id
      and public.has_project_access(t.project_id, target_user_id)
  );
$$;

-- projects
create policy "Users with project access can view projects"
on public.projects
for select
to authenticated
using (public.has_project_access(id));

create policy "Workspace admins or team leads can create projects"
on public.projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (public.is_workspace_admin(workspace_id) or (team_id is not null and public.is_team_lead(team_id)))
);

create policy "Project admins can update projects"
on public.projects
for update
to authenticated
using (public.is_project_admin(id))
with check (public.is_project_admin(id));

grant select, insert, update on public.projects to authenticated;

-- project_members
create policy "Users with project access can view project members"
on public.project_members
for select
to authenticated
using (public.has_project_access(project_id));

create policy "Project admins can add project members"
on public.project_members
for insert
to authenticated
with check (public.is_project_admin(project_id));

create policy "Project admins can remove project members"
on public.project_members
for delete
to authenticated
using (public.is_project_admin(project_id));

grant select, insert, delete on public.project_members to authenticated;

-- tasks — any project member can create/update tasks (Kanban board is a shared surface), but
-- an assignee must themselves have access to the project; only a project admin or the task's
-- own creator can delete it.
create policy "Users with project access can view tasks"
on public.tasks
for select
to authenticated
using (public.has_project_access(project_id));

create policy "Project members can create tasks"
on public.tasks
for insert
to authenticated
with check (
  public.has_project_access(project_id)
  and creator_id = auth.uid()
  and (assignee_id is null or public.has_project_access(project_id, assignee_id))
);

create policy "Project members can update tasks"
on public.tasks
for update
to authenticated
using (public.has_project_access(project_id))
with check (
  public.has_project_access(project_id)
  and (assignee_id is null or public.has_project_access(project_id, assignee_id))
);

create policy "Project admins or task creators can delete tasks"
on public.tasks
for delete
to authenticated
using (public.is_project_admin(project_id) or creator_id = auth.uid());

grant select, insert, update, delete on public.tasks to authenticated;

-- task_labels — workspace-wide configurable label set, management restricted to admins to
-- avoid duplicate/typo'd labels; any workspace member can see and apply them.
create policy "Workspace members can view labels"
on public.task_labels
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage labels"
on public.task_labels
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

grant select, insert, update, delete on public.task_labels to authenticated;

-- task_label_assignments — anyone with task access can tag/untag.
create policy "Task viewers can see label assignments"
on public.task_label_assignments
for select
to authenticated
using (public.can_access_task(task_id));

create policy "Task viewers can assign labels"
on public.task_label_assignments
for insert
to authenticated
with check (public.can_access_task(task_id));

create policy "Task viewers can remove labels"
on public.task_label_assignments
for delete
to authenticated
using (public.can_access_task(task_id));

grant select, insert, delete on public.task_label_assignments to authenticated;

-- task_comments
create policy "Task viewers can see comments"
on public.task_comments
for select
to authenticated
using (public.can_access_task(task_id));

create policy "Task viewers can add comments"
on public.task_comments
for insert
to authenticated
with check (public.can_access_task(task_id) and author_id = auth.uid());

create policy "Comment authors can edit their own comment"
on public.task_comments
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Comment authors or project admins can delete comments"
on public.task_comments
for delete
to authenticated
using (
  author_id = auth.uid()
  or public.is_project_admin((select project_id from public.tasks where id = task_id))
);

grant select, insert, update, delete on public.task_comments to authenticated;

-- Extend channels/files/activity_logs with an optional project_id, same pattern as team_id.
alter table public.channels add column if not exists project_id uuid references public.projects(id) on delete cascade;
create index if not exists channels_project_id_idx on public.channels (project_id);

alter table public.files add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.files add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists files_project_id_idx on public.files (project_id);
create index if not exists files_task_id_idx on public.files (task_id);

alter table public.activity_logs add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists activity_logs_project_id_idx on public.activity_logs (project_id);

-- Channel access must now also respect project membership when a channel belongs to a project.
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
      and (c.project_id is null or public.has_project_access(c.project_id))
  );
$$;

drop policy if exists "Workspace members can view accessible channels" on public.channels;
create policy "Workspace members can view accessible channels"
on public.channels
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (team_id is null or public.is_team_member(team_id))
  and (project_id is null or public.has_project_access(project_id))
);

drop policy if exists "Workspace members can create accessible channels" on public.channels;
create policy "Workspace members can create accessible channels"
on public.channels
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
  and (team_id is null or public.is_team_member(team_id))
  and (project_id is null or public.has_project_access(project_id))
);
