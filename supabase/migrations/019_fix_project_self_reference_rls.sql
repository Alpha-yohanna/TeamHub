-- Bug found via live testing: has_project_access(id)/is_project_admin(id), used as the SELECT/
-- UPDATE policy on the projects table itself, re-query "projects" from inside a security
-- definer function. That self-reference (a projects policy whose check function selects back
-- from projects) doesn't reliably see a row inserted/updated by the very same statement once
-- PostgREST chains .select() (which requires a RETURNING-time re-check against the SELECT
-- policy) — it fails with the same generic "new row violates row-level security policy" error
-- as a real WITH CHECK failure, even though a bare insert (no .select()) succeeds and the same
-- predicate evaluates true a moment later. has_project_access/is_project_admin stay unchanged
-- for every OTHER table (tasks, project_members, channels, task_comments, ...), where they're
-- a normal cross-table reference and this issue doesn't apply — only projects' own two policies
-- are rewritten here to check the row's own columns directly instead of re-selecting the table.

drop policy if exists "Users with project access can view projects" on public.projects;
create policy "Users with project access can view projects"
on public.projects
for select
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or public.is_project_member(id)
  or (team_id is not null and public.is_team_member(team_id))
);

drop policy if exists "Project admins can update projects" on public.projects;
create policy "Project admins can update projects"
on public.projects
for update
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or owner_id = auth.uid()
  or (team_id is not null and public.is_team_lead(team_id))
)
with check (
  public.is_workspace_admin(workspace_id)
  or owner_id = auth.uid()
  or (team_id is not null and public.is_team_lead(team_id))
);

-- Drop the temporary debug helpers used to diagnose the issue above.
drop function if exists public.debug_project_insert_check(uuid, uuid, uuid);
drop function if exists public.debug_list_policies(text);
