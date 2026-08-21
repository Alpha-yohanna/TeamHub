-- Phase 7 continued: the Activity spec explicitly calls for Member events (joined/invited/
-- removed), which activity_logs never recorded, and asks to "consider whether certain sensitive
-- administrative activity should only be visible to Owners/Admins." Member-management entries
-- are exactly that — restricted below to workspace admins, while every other activity category
-- keeps its existing workspace-wide visibility.

create index if not exists activity_logs_target_type_idx on public.activity_logs (target_type);

-- Extend accept_invitation() (same signature, in place) to also record the join as activity —
-- one atomic place, same reasoning as the notification centralization in migration 028.
create or replace function public.accept_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  inv public.invitations%rowtype;
  accepter_name text;
  workspace_name text;
begin
  current_email := public.current_user_email();
  if current_email is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv
  from public.invitations
  where id = target_invitation_id
    and status = 'pending'
    and lower(email) = lower(current_email);

  if not found then
    raise exception 'Invitation not found';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;

  select full_name into accepter_name from public.profiles where id = auth.uid();
  select name into workspace_name from public.workspaces where id = inv.workspace_id;

  insert into public.notifications (workspace_id, user_id, actor_id, type, title, message, target_type, target_id)
  values (
    inv.workspace_id,
    inv.invited_by,
    auth.uid(),
    'invitation_accepted',
    coalesce(accepter_name, 'Someone') || ' accepted your invitation',
    workspace_name,
    'workspace',
    inv.workspace_id
  );

  insert into public.activity_logs (workspace_id, actor_id, action, target_type, target_id, metadata)
  values (
    inv.workspace_id,
    auth.uid(),
    'member.joined',
    'member',
    auth.uid(),
    jsonb_build_object('name', coalesce(accepter_name, 'A new member'))
  );
end;
$$;

-- Member-management activity (invited/joined/removed) is visible to workspace admins only;
-- every other activity category is unchanged (workspace-wide, as before).
drop policy if exists "Workspace members can view activity" on public.activity_logs;
create policy "Workspace members can view activity"
on public.activity_logs
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (target_type is distinct from 'member' or public.is_workspace_admin(workspace_id))
);
