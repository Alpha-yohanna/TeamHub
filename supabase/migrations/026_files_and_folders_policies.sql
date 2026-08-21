-- Phase 6 continued: RLS for folders, plus the file capabilities that never had a policy at all
-- before now (rename/move/describe had no UPDATE policy; delete was uploader-only with no
-- moderation path, unlike every other resource in the app by this point).

create policy "Workspace members can view folders"
on public.folders
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create folders"
on public.folders
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "Creators or workspace admins can update folders"
on public.folders
for update
to authenticated
using (created_by = auth.uid() or public.is_workspace_admin(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Creators or workspace admins can delete folders"
on public.folders
for delete
to authenticated
using (created_by = auth.uid() or public.is_workspace_admin(workspace_id));

grant select, insert, update, delete on public.folders to authenticated;

-- files: rename/move/describe (uploader or workspace admin); widen delete the same way.
create policy "Uploaders or workspace admins can update files"
on public.files
for update
to authenticated
using (uploaded_by = auth.uid() or public.is_workspace_admin(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Uploaders can delete their own files" on public.files;
create policy "Uploaders or workspace admins can delete files"
on public.files
for delete
to authenticated
using (uploaded_by = auth.uid() or public.is_workspace_admin(workspace_id));

grant update on public.files to authenticated;

-- storage.objects delete previously only allowed the uploader (the storage "owner"); an admin
-- deleting someone else's file at the DB layer above would otherwise leave an orphaned object
-- because they'd be blocked from removing the underlying object.
drop policy if exists "Uploaders can delete their own workspace files" on storage.objects;
create policy "Uploaders or workspace admins can delete workspace files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workspace-files'
  and (owner = auth.uid() or public.is_workspace_admin(((storage.foldername(name))[1])::uuid))
);
