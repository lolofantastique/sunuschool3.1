alter table public.profiles add column if not exists is_director boolean not null default false;

update public.profiles set is_director = true where matricule in ('ADM-001','ALA-ADM-001');

create or replace function public.my_is_director() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_director from public.profiles where id = auth.uid()), false)
$$;
revoke execute on function public.my_is_director() from anon, public;
grant execute on function public.my_is_director() to authenticated;

create policy schools_update_director on public.schools for update to authenticated
  using (id = public.my_school_id() and public.my_is_director())
  with check (id = public.my_school_id() and public.my_is_director());
grant update on public.schools to authenticated;
