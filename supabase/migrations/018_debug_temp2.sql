create or replace function public.debug_list_policies(target_table text)
returns table(policyname text, cmd text, permissive text, qual text, with_check text, roles text[])
language sql
security definer
set search_path = public
stable
as $$
  select policyname, cmd, permissive, qual, with_check, roles
  from pg_policies
  where schemaname = 'public' and tablename = target_table;
$$;

grant execute on function public.debug_list_policies(text) to authenticated;
