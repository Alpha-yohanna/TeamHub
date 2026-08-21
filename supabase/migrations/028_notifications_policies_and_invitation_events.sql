-- Phase 7 continued: the notifications table never had a DELETE policy (dismiss was impossible
-- at any layer) or realtime enabled. Also centralizes workspace-invitation notifications at the
-- database layer — a single insert trigger + one RPC extension — rather than duplicating that
-- logic across client call sites, which is exactly the kind of multi-path duplication risk this
-- phase asks to avoid.

create policy "Users can delete their own notifications"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

grant delete on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

-- If the invited email already belongs to an existing TeamHub user, notify them immediately
-- (in addition to the existing invite email) — fires exactly once, at insert time, regardless
-- of which UI path created the invitation.
create or replace function public.notify_invitee_if_existing_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitee_id uuid;
  inviter_name text;
  workspace_name text;
begin
  select au.id into invitee_id
  from auth.users au
  where lower(au.email) = lower(new.email)
  limit 1;

  if invitee_id is not null then
    select full_name into inviter_name from public.profiles where id = new.invited_by;
    select name into workspace_name from public.workspaces where id = new.workspace_id;

    insert into public.notifications (workspace_id, user_id, actor_id, type, title, message, target_type, target_id)
    values (
      new.workspace_id,
      invitee_id,
      new.invited_by,
      'workspace_invitation',
      coalesce(inviter_name, 'Someone') || ' invited you to ' || coalesce(workspace_name, 'a workspace'),
      'Open your dashboard to accept or decline.',
      'workspace',
      new.workspace_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_invitation_created_notify on public.invitations;
create trigger on_invitation_created_notify
  after insert on public.invitations
  for each row execute procedure public.notify_invitee_if_existing_user();

-- Extend the existing accept_invitation() RPC (same signature, in place) to notify the original
-- inviter — one atomic place this can happen, instead of every client call site that might
-- invoke acceptance having to remember to do it.
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
end;
$$;
