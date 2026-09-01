-- TeamHub has no site-wide admin role today — every existing "admin" check
-- (is_workspace_admin) is scoped to a single workspace via workspace_members.role.
-- This introduces a platform-wide admin concept instead, deliberately kept separate
-- from workspace roles and from profiles.role (which the existing "Users can update
-- their own profile" policy lets a user write to for their own row — reusing that
-- column for a global admin flag would let any user grant themselves super-admin).
-- super_admins has no RLS policies for the `authenticated` role at all, so it can
-- only be read/written by the service role or by you directly in the SQL editor —
-- never by a client request, no matter who is signed in.
--
-- is_super_admin() is the single gate meant to cover every future platform-wide
-- admin surface, not just announcements — e.g. a later admin inbox for Support,
-- Feedback, and Bug Report submissions (user → admin, the inverse direction of
-- announcements) should reuse this same function rather than inventing another
-- role check, so there is exactly one place that defines "who is a super admin."
create table if not exists public.super_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

-- Lets the frontend (and any RLS policy) cheaply ask "is the caller a super admin?"
-- without granting SELECT on super_admins itself.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.super_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

-- History of sent announcements, for the admin UI and for the send-announcement
-- Edge Function's own rate-limit check (last "all" send timestamp). Support,
-- Feedback, and Bug Reports are the opposite direction (user → admin) and carry
-- different fields/lifecycle (a submitter needs to see their own row; an admin
-- needs to triage/status it), so they belong in their own future table(s) rather
-- than a "type" column bolted onto this one — this table stays announcements-only.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  message text not null,
  scope text not null check (scope in ('test', 'all')),
  recipient_count integer not null default 0,
  sent_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Rows are only ever written by the Edge Function via the service-role key (which
-- bypasses RLS), so the only policy needed here is read access for super admins.
create policy "Super admins can view announcements"
on public.announcements
for select
to authenticated
using (public.is_super_admin());
