-- Phase 8: Settings > Workspace lets Owners AND Admins edit workspace name/description/org type,
-- but the original policy (migration 001) only ever allowed the owner (owner_id = auth.uid()).
-- Widen it to match is_workspace_admin(), the same owner-or-admin check already used everywhere
-- else in the app (member management, project administration, etc).
drop policy if exists "Workspace owners can update their workspace" on public.workspaces;
create policy "Workspace admins can update their workspace"
on public.workspaces
for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

-- Case-insensitive search on member name/username/email (Settings > Members search and
-- global search "People" results) benefits from a trigram index the same way messages already
-- have one (migration 020); profiles.full_name/username/email are the columns ilike'd against.
create index if not exists profiles_full_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index if not exists profiles_email_trgm_idx on public.profiles using gin (email gin_trgm_ops);
create index if not exists teams_name_trgm_idx on public.teams using gin (name gin_trgm_ops);
create index if not exists projects_name_trgm_idx on public.projects using gin (name gin_trgm_ops);
create index if not exists tasks_title_trgm_idx on public.tasks using gin (title gin_trgm_ops);
create index if not exists files_name_trgm_idx on public.files using gin (name gin_trgm_ops);
