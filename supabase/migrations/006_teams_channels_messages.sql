-- Teams (workspace-scoped groups of members) and their membership.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- Channels and messages, scoped directly to a workspace (independent of teams).
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;

-- Same security definer pattern as workspace_members: a team_members policy that queried
-- itself would hit the same 42P17 infinite recursion, so membership checks route through
-- a bypass-RLS function instead of a raw self-referencing subquery.
create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
  );
$$;

create policy "Workspace members can view teams"
on public.teams
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create teams"
on public.teams
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "Workspace members can view team members"
on public.team_members
for select
to authenticated
using (public.is_workspace_member((select workspace_id from public.teams where id = team_id)));

create policy "Workspace members can add team members"
on public.team_members
for insert
to authenticated
with check (public.is_workspace_member((select workspace_id from public.teams where id = team_id)));

create policy "Workspace members can view channels"
on public.channels
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create channels"
on public.channels
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "Workspace members can view messages"
on public.messages
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can send messages"
on public.messages
for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and sender_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert on public.teams to authenticated;
grant select, insert on public.team_members to authenticated;
grant select, insert on public.channels to authenticated;
grant select, insert on public.messages to authenticated;
