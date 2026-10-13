alter table public.teachers add column if not exists deleted_at timestamptz;

alter table public.schools add column if not exists phones text[] not null default '{}';
update public.schools set phones = array[phone] where coalesce(phone,'') <> '' and phones = '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos','school-logos', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy school_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'school-logos' and (storage.foldername(name))[1] = public.my_school_id()::text and public.my_is_director());
create policy school_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'school-logos' and (storage.foldername(name))[1] = public.my_school_id()::text and public.my_is_director())
  with check (bucket_id = 'school-logos' and (storage.foldername(name))[1] = public.my_school_id()::text and public.my_is_director());
create policy school_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'school-logos' and (storage.foldername(name))[1] = public.my_school_id()::text and public.my_is_director());

create or replace function public.purge_trash() returns void
 language sql security definer set search_path to 'public' as $$
  delete from public.classes where deleted_at is not null and deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.students s where s.class_id = classes.id);
  delete from public.teachers where deleted_at is not null and deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.teacher_slots t where t.teacher_id = teachers.id);
$$;
revoke all on function public.purge_trash() from public, anon, authenticated;
