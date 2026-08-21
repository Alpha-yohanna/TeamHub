-- Lets an existing workspace member invite someone else by email. Without this, workspace
-- membership can only ever grow at signup time (one person, one personal workspace) with no
-- way for a second person to actually join it through the app.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.invitations enable row level security;

create policy "Workspace members can view invitations they sent"
on public.invitations
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Invited users can view their own invitations"
on public.invitations
for select
to authenticated
using (lower(email) = lower((select email from auth.users where id = auth.uid())));

create policy "Workspace members can create invitations"
on public.invitations
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and invited_by = auth.uid());

grant select, insert on public.invitations to authenticated;

-- Called right after login so any invitation addressed to the signed-in user's email is
-- auto-joined without a separate accept step. Security definer so it can insert into
-- workspace_members regardless of the caller's own membership (they have none yet).
create or replace function public.accept_all_pending_invitations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  inv record;
begin
  select email into current_email from auth.users where id = auth.uid();

  if current_email is null then
    return;
  end if;

  for inv in
    select * from public.invitations
    where status = 'pending' and lower(email) = lower(current_email)
  loop
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;

    update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  end loop;
end;
$$;

grant execute on function public.accept_all_pending_invitations() to authenticated;
