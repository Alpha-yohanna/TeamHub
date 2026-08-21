-- "Workspace owners can manage members" (on workspace_members) queried workspaces, and
-- "Members can view their workspaces" (on workspaces) queried workspace_members, forming a
-- mutual-recursion cycle between the two tables' RLS policies (42P17). Routing both checks
-- through security definer functions makes each check bypass RLS internally, breaking the cycle.
create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and owner_id = auth.uid()
  );
$$;

drop policy if exists "Workspace owners can manage members" on public.workspace_members;
create policy "Workspace owners can manage members"
on public.workspace_members
for all
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));
