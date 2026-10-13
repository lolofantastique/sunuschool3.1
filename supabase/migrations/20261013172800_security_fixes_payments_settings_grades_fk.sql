drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to public
  using (school_id = my_school_id() and (my_role() = 'admin'::text or student_id in (
    select s.id from public.students s where s.matricule = my_matricule() and s.school_id = my_school_id())));

drop policy if exists schools_admin_update on public.schools;

alter table public.grades drop constraint if exists grades_school_id_fkey;
alter table public.grades add constraint grades_school_id_fkey foreign key (school_id) references public.schools(id);
