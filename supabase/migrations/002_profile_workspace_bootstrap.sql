-- Keeps profiles/workspaces updated_at accurate on every row change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute procedure public.set_updated_at();

-- Provisions a profile plus a personal default workspace the moment someone signs up in auth.users,
-- so the app always has a workspace to render right after signup instead of an empty state.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  base_username text;
  new_username text;
  new_workspace_id uuid;
  base_slug text;
  new_slug text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]+', '-', 'gi'));
  new_username := base_username || '-' || substr(new.id::text, 1, 6);

  insert into public.profiles (id, full_name, username, avatar_url, role, status, bio)
  values (new.id, display_name, new_username, null, 'owner', 'online', null);

  base_slug := new_username || '-workspace';
  new_slug := base_slug;

  insert into public.workspaces (name, slug, description, owner_id)
  values (display_name || '''s Workspace', new_slug, 'Default workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
