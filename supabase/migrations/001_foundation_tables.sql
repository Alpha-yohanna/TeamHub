create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique,
  avatar_url text,
  role text not null default 'member' check (role in ('owner', 'admin', 'manager', 'member')),
  status text not null default 'offline' check (status in ('online', 'away', 'busy', 'offline')),
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'manager', 'member')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Members can view their workspaces"
on public.workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = workspaces.id
      and workspace_members.user_id = auth.uid()
  )
);

create policy "Workspace owners can update their workspace"
on public.workspaces
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Authenticated users can create workspaces"
on public.workspaces
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Members can view workspace membership"
on public.workspace_members
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members as current_membership
    where current_membership.workspace_id = workspace_members.workspace_id
      and current_membership.user_id = auth.uid()
  )
);

create policy "Workspace owners can manage members"
on public.workspace_members
for all
to authenticated
using (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_members.workspace_id
      and workspaces.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspaces
    where workspaces.id = workspace_members.workspace_id
      and workspaces.owner_id = auth.uid()
  )
);
