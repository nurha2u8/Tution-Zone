-- ROLES ---------------------------------------------------------------
create type public.app_role as enum ('teacher', 'student');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "teachers read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'teacher'));

-- PROFILES ------------------------------------------------------------
create table public.profiles (
  id uuid primary key,
  email text,
  full_name text not null default '',
  student_id text,
  phone text,
  class_selected text,
  subject_selected text,
  role text not null default 'student',
  created_at timestamptz not null default now()
);
create unique index profiles_student_id_class_uniq
  on public.profiles (lower(student_id), lower(class_selected))
  where student_id is not null and class_selected is not null;

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "teachers read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'teacher'));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- SUBJECTS ------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "any authed read subjects" on public.subjects for select to authenticated using (true);
create policy "teachers add subjects" on public.subjects for insert to authenticated with check (public.has_role(auth.uid(), 'teacher'));
create policy "teachers delete own subjects" on public.subjects for delete to authenticated using (created_by = auth.uid());

-- CLASSES -------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  class_name text not null,
  subject_name text not null,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;
create policy "authed read classes" on public.classes for select to authenticated using (true);
create policy "teachers insert own classes" on public.classes for insert to authenticated with check (teacher_id = auth.uid() and public.has_role(auth.uid(), 'teacher'));
create policy "teachers update own classes" on public.classes for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teachers delete own classes" on public.classes for delete to authenticated using (teacher_id = auth.uid());

-- ATTENDANCE ----------------------------------------------------------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null check (status in ('present','absent')),
  marked_at timestamptz not null default now(),
  unique (student_id, class_id)
);
grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;
create policy "students read own attendance" on public.attendance for select to authenticated using (student_id = auth.uid());
create policy "teachers read class attendance" on public.attendance for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));
create policy "teachers mark attendance" on public.attendance for insert to authenticated
  with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));
create policy "teachers update attendance" on public.attendance for update to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));
create policy "teachers delete attendance" on public.attendance for delete to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid()));

-- NOTIFICATIONS -------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_students_on_class()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, title, body)
  select p.id,
         'নতুন ক্লাস: ' || new.subject_name,
         new.class_name || ' · ' || to_char(new.scheduled_date, 'DD Mon YYYY') || ' · ' ||
         to_char(new.start_time, 'HH24:MI') || '–' || to_char(new.end_time, 'HH24:MI')
  from public.profiles p
  where p.role = 'student' and lower(p.class_selected) = lower(new.class_name);
  return new;
end;
$$;
create trigger on_class_created after insert on public.classes
for each row execute function public.notify_students_on_class();

-- TEACHER ACCESS CODES ------------------------------------------------
create table public.teacher_access_codes (
  code text primary key,
  created_at timestamptz not null default now()
);
grant all on public.teacher_access_codes to service_role;
alter table public.teacher_access_codes enable row level security;
insert into public.teacher_access_codes (code) values ('TEACH-2026');

create or replace function public.claim_teacher_role(_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null then return false; end if;
  select exists (select 1 from public.teacher_access_codes where code = _code) into ok;
  if not ok then return false; end if;
  delete from public.user_roles where user_id = auth.uid();
  insert into public.user_roles (user_id, role) values (auth.uid(), 'teacher') on conflict do nothing;
  update public.profiles set role = 'teacher', student_id = null, class_selected = null where id = auth.uid();
  return true;
end;
$$;
grant execute on function public.claim_teacher_role(text) to authenticated;

-- NEW USER HANDLER ----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, student_id, phone, class_selected, subject_selected, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'class_selected', ''),
    nullif(new.raw_user_meta_data ->> 'subject_selected', ''),
    'student'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- SAMPLE SUBJECTS -----------------------------------------------------
insert into public.subjects (name) values
  ('Mathematics'), ('Physics'), ('Chemistry'), ('Biology'), ('English'), ('ICT')
on conflict (name) do nothing;
