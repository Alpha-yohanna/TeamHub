-- Phase 7: Notifications + Activity. Extends the existing notifications/activity_logs tables
-- (no new tables — the existing schema already covers what's needed) with the fields required
-- for click-to-navigate and the query patterns the spec calls out, plus indexes.

alter table public.notifications add column if not exists target_type text;
alter table public.notifications add column if not exists target_id uuid;
alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_read_idx on public.notifications (user_id, read_at);
create index if not exists notifications_workspace_created_idx on public.notifications (workspace_id, created_at desc);

create index if not exists activity_logs_workspace_created_idx on public.activity_logs (workspace_id, created_at desc);
create index if not exists activity_logs_team_idx on public.activity_logs (team_id) where team_id is not null;
create index if not exists activity_logs_project_idx on public.activity_logs (project_id) where project_id is not null;
