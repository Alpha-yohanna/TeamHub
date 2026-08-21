-- Signup flow now asks new workspace owners two short onboarding questions (team size, primary
-- use case) alongside the existing name/org_type/description fields. Both are plain optional text
-- so the client can offer a fixed set of options without the database enforcing a specific list
-- (matches how org_type was added in migration 030 — no CHECK constraint there either).
alter table public.workspaces add column if not exists team_size text;
alter table public.workspaces add column if not exists use_case text;
