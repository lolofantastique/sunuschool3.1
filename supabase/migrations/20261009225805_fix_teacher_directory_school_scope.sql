create or replace function public.teacher_directory()
returns table(id bigint, full_name text, subject text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.full_name, t.subject
  from public.teachers t
  where t.school_id = (select school_id from public.profiles where id = auth.uid())
$$;

revoke execute on function public.my_school_id() from anon, public;
grant execute on function public.my_school_id() to authenticated;
