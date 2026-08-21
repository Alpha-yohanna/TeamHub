-- Phase 8: Search + Settings + Workspace Switching + Onboarding.
-- Adds only what doesn't already exist: a per-user preferences row (appearance + notification
-- toggles), onboarding/org-type state on workspaces (reusing the existing workspaces table
-- rather than a new one), and a public avatar bucket. Everything else this phase needs
-- (workspace creation policy, workspace-scoped queries, RLS on messages/files/projects/tasks)
-- already exists from earlier phases.

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notify_mentions boolean not null default true,
  notify_direct_messages boolean not null default true,
  notify_task_assignments boolean not null default true,
  notify_project_updates boolean not null default true,
  notify_team_activity boolean not null default true,
  notify_file_sharing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can view their own preferences"
on public.user_preferences
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their own preferences"
on public.user_preferences
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own preferences"
on public.user_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.user_preferences to authenticated;

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

-- Onboarding + org type live on the existing workspaces table rather than a new one — an
-- onboarding flow is inherently a property of one workspace's setup progress.
alter table public.workspaces add column if not exists org_type text;
alter table public.workspaces add column if not exists onboarding_step int not null default 0;
alter table public.workspaces add column if not exists onboarding_completed_at timestamptz;

-- Workspaces created before this migration predate onboarding entirely; mark them completed so
-- existing users are never retroactively shown the onboarding flow. Only workspaces created after
-- this migration get onboarding_completed_at = null (the column default) and see it.
update public.workspaces set onboarding_completed_at = created_at where onboarding_completed_at is null;

-- Public avatar bucket. Unlike workspace-files (private, signed-URL), avatars need to render for
-- any viewer without a round trip, so reads are public; writes are restricted to the owning
-- user's own folder ("<user_id>/filename"), mirroring the workspace-files folder-scoping pattern.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "TeamHub avatars are publicly readable" on storage.objects;
create policy "TeamHub avatars are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "TeamHub users can upload their own avatar" on storage.objects;
create policy "TeamHub users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "TeamHub users can replace their own avatar" on storage.objects;
create policy "TeamHub users can replace their own avatar"
on storage.objects
for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "TeamHub users can delete their own avatar" on storage.objects;
create policy "TeamHub users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
