-- Phase 6: Files. Adds folders and the file metadata Phase 6 needs (description, updated_at,
-- folder_id) — reuses the existing files/workspace-files-bucket architecture rather than
-- building a parallel one. Table DDL only in this migration; policies land in 026, same
-- two-migration split used since Phase 4 to avoid same-statement RETURNING visibility issues.

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_workspace_id_idx on public.folders (workspace_id);
create index if not exists folders_parent_folder_id_idx on public.folders (parent_folder_id);

alter table public.files add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.files add column if not exists description text;
alter table public.files add column if not exists updated_at timestamptz not null default now();

create index if not exists files_folder_id_idx on public.files (folder_id);

-- Reuses the set_updated_at() trigger function already defined in migration 002.
drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at
  before update on public.folders
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_files_updated_at on public.files;
create trigger set_files_updated_at
  before update on public.files
  for each row execute procedure public.set_updated_at();

alter table public.folders enable row level security;
