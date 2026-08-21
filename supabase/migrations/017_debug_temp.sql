create or replace function public.debug_project_insert_check(p_workspace_id uuid, p_team_id uuid, p_owner_id uuid)
returns table(owner_ok boolean, admin_ok boolean, lead_ok boolean, team_not_null boolean, final_check boolean, caller uuid)
language sql
security invoker
set search_path = public
stable
as $$
  select
    p_owner_id = auth.uid() as owner_ok,
    public.is_workspace_admin(p_workspace_id) as admin_ok,
    public.is_team_lead(p_team_id) as lead_ok,
    p_team_id is not null as team_not_null,
    (p_owner_id = auth.uid()) and (public.is_workspace_admin(p_workspace_id) or (p_team_id is not null and public.is_team_lead(p_team_id))) as final_check,
    auth.uid() as caller;
$$;

grant execute on function public.debug_project_insert_check(uuid, uuid, uuid) to authenticated;

create or replace function public.debug_list_policies(target_table text)
returns table(policyname text, cmd text, permissive text, qual text, with_check text, roles text[])
language sql
security definer
set search_path = public
stable
as $$
  select policyname, cmd, permissive, qual, with_check, roles
  from pg_policies
  where schemaname = 'public' and tablename = target_table;
$$;

grant execute on function public.debug_list_policies(text) to authenticated;
