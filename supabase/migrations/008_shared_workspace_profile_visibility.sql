-- profiles previously only allowed viewing your own row, which silently broke every embedded
-- join that shows another member's name (team rosters, message senders, file uploaders,
-- notifications) since PostgREST drops rows whose embedded child fails RLS. Workspace-mates
-- need to see each other's basic profile info; routed through security definer to avoid
-- recursing back into workspace_members RLS.
create or replace function public.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm1
    join public.workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
    where wm1.user_id = auth.uid()
      and wm2.user_id = target_user_id
  );
$$;

create policy "Workspace members can view each other's profiles"
on public.profiles
for select
to authenticated
using (public.shares_workspace_with(id));
