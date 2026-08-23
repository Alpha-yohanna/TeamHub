-- New users must start on light mode rather than following OS preference. This only changes the
-- column default for rows inserted from now on (first save from Settings > Appearance, or any
-- future auto-provisioning) — existing users keep whatever theme they already saved.
alter table public.user_preferences
  alter column theme set default 'light';
