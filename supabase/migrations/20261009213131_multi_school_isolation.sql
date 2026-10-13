-- Plusieurs écoles dans une seule base.
-- Suppose que la table schools et les colonnes school_id existent déjà (voir README).

do $$
declare sid bigint;
begin
  select min(id) into sid from public.schools;
  if sid is null then
    insert into public.schools (name) values ('Mon école') returning id into sid;
  end if;
  update public.profiles set school_id = sid where school_id is null;
  update public.teachers set school_id = sid where school_id is null;
  update public.classes set school_id = sid where school_id is null;
  update public.students set school_id = sid where school_id is null;
  update public.teacher_slots set school_id = sid where school_id is null;
  update public.subjects set school_id = sid where school_id is null;
  update public.grades set school_id = sid where school_id is null;
  update public.attendance set school_id = sid where school_id is null;
  update public.payments set school_id = sid where school_id is null;
end $$;

alter table public.profiles add constraint profiles_school_fk foreign key (school_id) references public.schools(id);

create or replace function public.my_school_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select school_id from public.profiles where id = auth.uid()
$$;
grant execute on function public.my_school_id() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','teachers','classes','students','teacher_slots','subjects','grades','attendance','payments']
  loop
    execute format('alter table public.%I alter column school_id set not null', t);
    execute format('create index if not exists %I on public.%I (school_id)', t||'_school_idx', t);
    if t <> 'profiles' then
      execute format('alter table public.%I alter column school_id set default public.my_school_id()', t);
    end if;
    execute format($f$create policy school_isolation on public.%I as restrictive for all to authenticated using (school_id = public.my_school_id()) with check (school_id = public.my_school_id())$f$, t);
  end loop;
end $$;

alter table public.profiles drop constraint if exists profiles_matricule_key;
alter table public.teachers drop constraint if exists teachers_matricule_key;
alter table public.students drop constraint if exists students_matricule_key;
alter table public.classes drop constraint if exists classes_name_key;
alter table public.subjects drop constraint if exists subjects_name_key;
alter table public.profiles add unique (school_id, matricule);
alter table public.teachers add unique (school_id, matricule);
alter table public.students add unique (school_id, matricule);
alter table public.classes add unique (school_id, name);
alter table public.subjects add unique (school_id, name);

create policy schools_read on public.schools for select to authenticated using (id = public.my_school_id());
grant select on public.schools to authenticated;
