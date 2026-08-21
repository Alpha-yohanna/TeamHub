create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

create policy "Workspace members can view files"
on public.files
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can upload files"
on public.files
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and uploaded_by = auth.uid());

create policy "Uploaders can delete their own files"
on public.files
for delete
to authenticated
using (uploaded_by = auth.uid());

create policy "Users can view their own notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "Workspace members can create notifications"
on public.notifications
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

create policy "Users can update their own notifications"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Workspace members can view activity"
on public.activity_logs
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can log activity"
on public.activity_logs
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

grant select, insert, delete on public.files to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select, insert on public.activity_logs to authenticated;

-- Private bucket for workspace file uploads. Objects are stored under
-- "<workspace_id>/<filename>" so storage policies can gate access by workspace membership.
insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict (id) do nothing;

create policy "Workspace members can read workspace files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workspace-files'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "Workspace members can upload workspace files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workspace-files'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "Uploaders can delete their own workspace files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workspace-files'
  and owner = auth.uid()
);
