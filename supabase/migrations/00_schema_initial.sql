-- SunuSchool : schéma de départ (une seule école). Rôles : student, teacher, admin.

create table public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  role      text not null check (role in ('student','teacher','admin')),
  matricule text not null unique,
  full_name text not null
);

create table public.teachers (
  id        bigint generated always as identity primary key,
  user_id   uuid unique references auth.users(id) on delete set null,
  matricule text not null unique,
  full_name text not null,
  subject   text not null,
  phone     text,
  coeff     numeric(3,1) not null default 1 check (coeff > 0)
);

create table public.classes (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  level      text not null check (level in ('Primaire','Collège','Lycée')),
  room       text,
  head_teacher_id bigint references public.teachers(id) on delete set null,
  deleted_at timestamptz
);

create table public.students (
  id          bigint generated always as identity primary key,
  user_id     uuid unique references auth.users(id) on delete set null,
  matricule   text not null unique,
  full_name   text not null,
  sex         text check (sex in ('F','M')),
  class_id    bigint references public.classes(id) on delete set null,
  parent_name text,
  phone       text,
  monthly_fee integer not null default 0 check (monthly_fee >= 0)
);

create table public.teacher_slots (
  id         bigint generated always as identity primary key,
  teacher_id bigint not null references public.teachers(id) on delete cascade,
  class_id   bigint not null references public.classes(id) on delete cascade,
  day        text not null check (day in ('Lun','Mar','Mer','Jeu','Ven','Sam')),
  start_time time not null,
  end_time   time not null,
  room       text,
  check (end_time > start_time)
);

create table public.subjects (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  coeff      numeric(3,1) not null default 1 check (coeff > 0),
  teacher_id bigint references public.teachers(id) on delete set null
);

create table public.grades (
  id         bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  semester   text not null check (semester in ('S1','S2')),
  d1         numeric(4,2) check (d1 between 0 and 20),
  d2         numeric(4,2) check (d2 between 0 and 20),
  compo      numeric(4,2) check (compo between 0 and 20),
  average    numeric(4,2) check (average between 0 and 20),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, semester)
);

create table public.attendance (
  id           bigint generated always as identity primary key,
  student_id   bigint not null references public.students(id) on delete cascade,
  class_id     bigint references public.classes(id) on delete set null,
  day          date not null,
  status       text not null check (status in ('A','J','R')),
  minutes_late integer not null default 0 check (minutes_late >= 0),
  reason       text,
  recorded_by  uuid references auth.users(id),
  unique (student_id, day)
);

create table public.payments (
  id         bigint generated always as identity primary key,
  receipt_no text not null,
  student_id bigint not null references public.students(id) on delete cascade,
  month      text not null check (month in
             ('Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai','Juin')),
  amount     integer not null check (amount > 0),
  method     text not null check (method in ('Wave','Orange Money','Espèces')),
  reference  text,
  paid_on    date not null default current_date,
  recorded_by uuid references auth.users(id),
  unique (receipt_no, student_id, month)
);

create index on public.students (class_id);
create index on public.teacher_slots (teacher_id, class_id);
create index on public.grades (student_id);
create index on public.attendance (student_id, day);
create index on public.payments (student_id);

-- Fonctions d'aide
create function public.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;
create function public.my_student_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select id from public.students where user_id = auth.uid()
$$;
create function public.my_class_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select class_id from public.students where user_id = auth.uid()
$$;
create function public.my_teacher_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select id from public.teachers where user_id = auth.uid()
$$;
grant execute on function public.app_role(), public.my_student_id(),
  public.my_class_id(), public.my_teacher_id() to authenticated;

-- Row Level Security
alter table public.profiles      enable row level security;
alter table public.teachers      enable row level security;
alter table public.classes       enable row level security;
alter table public.students      enable row level security;
alter table public.teacher_slots enable row level security;
alter table public.subjects      enable row level security;
alter table public.grades        enable row level security;
alter table public.attendance    enable row level security;
alter table public.payments      enable row level security;

create policy profiles_self  on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_admin on public.profiles for select to authenticated using (public.app_role() = 'admin');

create policy classes_read  on public.classes for select to authenticated using (true);
create policy classes_admin on public.classes for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy subjects_read  on public.subjects for select to authenticated using (true);
create policy subjects_admin on public.subjects for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

create policy teachers_admin on public.teachers for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy teachers_self  on public.teachers for select to authenticated using (user_id = auth.uid());

create policy students_admin   on public.students for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy students_self    on public.students for select to authenticated using (user_id = auth.uid());
create policy students_teacher on public.students for select to authenticated
  using (public.app_role() = 'teacher' and exists (
    select 1 from public.teacher_slots ts
    where ts.teacher_id = public.my_teacher_id() and ts.class_id = students.class_id));

create policy slots_admin   on public.teacher_slots for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy slots_teacher on public.teacher_slots for select to authenticated using (teacher_id = public.my_teacher_id());
create policy slots_student on public.teacher_slots for select to authenticated using (class_id = public.my_class_id());

create policy grades_student on public.grades for select to authenticated using (student_id = public.my_student_id());
create policy grades_admin   on public.grades for select to authenticated using (public.app_role() = 'admin');
create policy grades_teacher_read on public.grades for select to authenticated
  using (public.app_role() = 'teacher'
    and exists (select 1 from public.subjects s
                where s.id = grades.subject_id and s.teacher_id = public.my_teacher_id()));
create policy grades_teacher_insert on public.grades for insert to authenticated
  with check (public.app_role() = 'teacher'
    and exists (select 1 from public.subjects s
                where s.id = grades.subject_id and s.teacher_id = public.my_teacher_id())
    and exists (select 1 from public.students st
                join public.teacher_slots ts on ts.class_id = st.class_id
                where st.id = grades.student_id and ts.teacher_id = public.my_teacher_id()));
create policy grades_teacher_update on public.grades for update to authenticated
  using (public.app_role() = 'teacher'
    and exists (select 1 from public.subjects s
                where s.id = grades.subject_id and s.teacher_id = public.my_teacher_id()))
  with check (public.app_role() = 'teacher'
    and exists (select 1 from public.subjects s
                where s.id = grades.subject_id and s.teacher_id = public.my_teacher_id())
    and exists (select 1 from public.students st
                join public.teacher_slots ts on ts.class_id = st.class_id
                where st.id = grades.student_id and ts.teacher_id = public.my_teacher_id()));

create policy attendance_admin   on public.attendance for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy attendance_student on public.attendance for select to authenticated using (student_id = public.my_student_id());
create policy attendance_teacher on public.attendance for all to authenticated
  using (public.app_role() = 'teacher' and exists (
    select 1 from public.teacher_slots ts
    where ts.teacher_id = public.my_teacher_id() and ts.class_id = attendance.class_id))
  with check (public.app_role() = 'teacher' and exists (
    select 1 from public.teacher_slots ts
    where ts.teacher_id = public.my_teacher_id() and ts.class_id = attendance.class_id));

create policy payments_admin   on public.payments for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy payments_student on public.payments for select to authenticated using (student_id = public.my_student_id());

-- Droits
grant select                         on public.profiles      to authenticated;
grant select, insert, update, delete on public.teachers      to authenticated;
grant select, insert, update, delete on public.classes       to authenticated;
grant select, insert, update, delete on public.students      to authenticated;
grant select, insert, update, delete on public.teacher_slots to authenticated;
grant select, insert, update, delete on public.subjects      to authenticated;
grant select, insert, update         on public.grades        to authenticated;
grant select, insert, update, delete on public.attendance    to authenticated;
grant select, insert, update, delete on public.payments      to authenticated;
