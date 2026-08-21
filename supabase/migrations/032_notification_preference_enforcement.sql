-- Phase 8: Settings > Notifications toggles must actually suppress notifications, not just save
-- to a column nobody reads. The sender's client can't check the recipient's user_preferences row
-- itself (RLS is rightly self-only — you can't read someone else's settings), so enforcement has
-- to happen inside the database. A BEFORE INSERT trigger checks the recipient's preference for
-- the notification's type and returns null (silently drops the row, no error) when disabled.
-- Types with no mapping below (workspace invitations, invitation-accepted receipts) are always
-- sent — they're account-level notices, not the per-category noise the toggles control.
create or replace function public.filter_notification_by_preference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preference_column text;
  is_enabled boolean;
begin
  preference_column := case new.type
    when 'mention' then 'notify_mentions'
    when 'direct_message' then 'notify_direct_messages'
    when 'thread_reply' then 'notify_direct_messages'
    when 'task_assigned' then 'notify_task_assignments'
    when 'task_due_date_changed' then 'notify_task_assignments'
    when 'task_comment' then 'notify_task_assignments'
    when 'project_status_changed' then 'notify_project_updates'
    when 'project_added' then 'notify_project_updates'
    when 'project_removed' then 'notify_project_updates'
    when 'team_added' then 'notify_team_activity'
    when 'team_removed' then 'notify_team_activity'
    when 'team_lead_assigned' then 'notify_team_activity'
    when 'file_shared' then 'notify_file_sharing'
    else null
  end;

  if preference_column is null then
    return new;
  end if;

  execute format('select %I from public.user_preferences where user_id = $1', preference_column)
    into is_enabled
    using new.user_id;

  -- No preferences row yet means the user is still on defaults (all true) — only an explicit
  -- false suppresses the notification.
  if is_enabled is false then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists before_insert_filter_notification_preference on public.notifications;
create trigger before_insert_filter_notification_preference
  before insert on public.notifications
  for each row execute procedure public.filter_notification_by_preference();
