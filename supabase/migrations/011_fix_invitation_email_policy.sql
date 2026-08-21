-- "Invited users can view their own invitations" queried auth.users directly inside its USING
-- clause. RLS policies run as the calling role (authenticated), which has no grant on
-- auth.users, so every invitation insert (which implicitly selects the row back) failed with
-- "permission denied for table users" (42501). Routing the email lookup through a security
-- definer function bypasses that restriction, same pattern as the workspace membership checks.
create or replace function public.current_user_email()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from auth.users where id = auth.uid();
$$;

drop policy if exists "Invited users can view their own invitations" on public.invitations;
create policy "Invited users can view their own invitations"
on public.invitations
for select
to authenticated
using (lower(email) = lower(public.current_user_email()));
