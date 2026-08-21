create or replace function public.debug_channel_member_insert_check(p_channel_id uuid, p_user_id uuid)
returns table(check1 boolean, check2 boolean, is_workspace_member_ok boolean, created_by_match boolean, caller uuid)
language sql
security invoker
set search_path = public
stable
as $$
  select
    exists (
      select 1 from channels c
      where c.id = p_channel_id
        and is_workspace_member(c.workspace_id)
        and (c.created_by = auth.uid() or is_channel_member(c.id))
    ) as check1,
    exists (
      select 1 from channels c2
      join workspace_members wm on wm.workspace_id = c2.workspace_id
      where c2.id = p_channel_id and wm.user_id = p_user_id
    ) as check2,
    (select is_workspace_member(workspace_id) from channels where id = p_channel_id) as is_workspace_member_ok,
    (select created_by = auth.uid() from channels where id = p_channel_id) as created_by_match,
    auth.uid() as caller;
$$;

grant execute on function public.debug_channel_member_insert_check(uuid, uuid) to authenticated;
