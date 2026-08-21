-- The original "Members can view workspace membership" policy queried workspace_members
-- from inside its own policy, which Postgres evaluates recursively under RLS and fails with
-- "infinite recursion detected in policy for relation workspace_members" (42P17). A
-- security definer function breaks the recursion because its internal query bypasses RLS.
create or replace function public.is_workspace_member(target_workspace_id uuid)
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
      and user_id = auth.uid()
  );
$$;

drop policy if exists "Members can view workspace membership" on public.workspace_members;
create policy "Members can view workspace membership"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));
