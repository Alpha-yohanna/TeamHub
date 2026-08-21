-- Phase 2: workspace admins (owner + admin) get real member-management power, and invited
-- users get an explicit accept/decline choice instead of every pending invite silently
-- auto-joining them on login.

create or replace function public.is_workspace_admin(target_workspace_id uuid)
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
      and role in ('owner', 'admin')
  );
$$;

-- The original "Workspace owners can manage members" (FOR ALL) policy meant only the owner
-- could ever change roles or remove someone. Split into insert (owner only, unchanged) plus
-- update/delete open to admins too, and block touching the owner's own row through this path.
drop policy if exists "Workspace owners can manage members" on public.workspace_members;

create policy "Workspace owners can add members directly"
on public.workspace_members
for insert
to authenticated
with check (public.is_workspace_owner(workspace_id));

create policy "Workspace admins can update member roles"
on public.workspace_members
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id) and role <> 'owner');

create policy "Workspace admins can remove members"
on public.workspace_members
for delete
to authenticated
using (public.is_workspace_admin(workspace_id) and role <> 'owner');

grant update, delete on public.workspace_members to authenticated;

-- Let a sent invitation be revoked before it's accepted, and let it be declined (new status).
alter table public.invitations drop constraint if exists invitations_status_check;
alter table public.invitations
  add constraint invitations_status_check check (status in ('pending', 'accepted', 'declined'));

create policy "Workspace admins can revoke pending invitations"
on public.invitations
for delete
to authenticated
using (public.is_workspace_admin(workspace_id) and status = 'pending');

grant delete on public.invitations to authenticated;

-- Security definer so the invited user (who isn't a workspace member yet) can still act on an
-- invitation addressed to their own email, same pattern as accept_all_pending_invitations.
create or replace function public.accept_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  inv public.invitations%rowtype;
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
end;
$$;

create or replace function public.decline_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  updated_count int;
begin
  current_email := public.current_user_email();
  if current_email is null then
    raise exception 'Not authenticated';
  end if;

  update public.invitations
  set status = 'declined'
  where id = target_invitation_id
    and status = 'pending'
    and lower(email) = lower(current_email);

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Invitation not found';
  end if;
end;
$$;

grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
