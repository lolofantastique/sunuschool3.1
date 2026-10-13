create or replace function public.sync_teacher_subject()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if exists (select 1 from public.subjects where teacher_id = new.id) then
    begin
      update public.subjects set name = new.subject, coeff = new.coeff where teacher_id = new.id;
    exception when unique_violation then
      update public.subjects set coeff = new.coeff where teacher_id = new.id;
    end;
  else
    insert into public.subjects (name, coeff, teacher_id, school_id)
    values (new.subject, new.coeff, new.id, new.school_id)
    on conflict (school_id, name) do update
      set teacher_id = coalesce(public.subjects.teacher_id, excluded.teacher_id);
  end if;
  return new;
end;
$function$;
