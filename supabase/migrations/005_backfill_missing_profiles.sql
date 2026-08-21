-- One-time backfill: accounts created before the profiles/workspaces rebuild in migration 001
-- exist in auth.users (owned by Supabase Auth, untouched by that rebuild) but have no matching
-- profile, which made every login for them fail at getProfile()'s .single() call. Runs the same
-- provisioning logic as handle_new_user() for every orphaned auth.users row.
do $$
declare
  u record;
  display_name text;
  base_username text;
  new_username text;
  new_workspace_id uuid;
  new_slug text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on p.id = au.id
    where p.id is null
  loop
    display_name := coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1));
    base_username := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]+', '-', 'gi'));
    new_username := base_username || '-' || substr(u.id::text, 1, 6);

    insert into public.profiles (id, full_name, username, avatar_url, role, status, bio)
    values (u.id, display_name, new_username, null, 'owner', 'online', null);

    new_slug := new_username || '-workspace';

    insert into public.workspaces (name, slug, description, owner_id)
    values (display_name || '''s Workspace', new_slug, 'Default workspace', u.id)
    returning id into new_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, u.id, 'owner');
  end loop;
end;
$$;
