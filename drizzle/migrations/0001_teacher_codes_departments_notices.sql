-- 1. New columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teacher_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teacher_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS department text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_teacher_code_uniq
  ON public.profiles (teacher_code) WHERE teacher_code IS NOT NULL;

-- 2. Teacher code generator
CREATE OR REPLACE FUNCTION public.gen_teacher_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare c text;
begin
  loop
    c := 'T-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.profiles where teacher_code = c);
  end loop;
  return c;
end;
$$;

-- backfill codes for existing teachers
UPDATE public.profiles
SET teacher_code = public.gen_teacher_code()
WHERE role = 'teacher' AND teacher_code IS NULL;

-- 3. Helpers
CREATE OR REPLACE FUNCTION public.my_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ select teacher_id from public.profiles where id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.find_teacher_by_code(_code text)
RETURNS TABLE (teacher_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select p.id, p.full_name
  from public.profiles p
  where p.role = 'teacher'
    and upper(p.teacher_code) = upper(btrim(_code))
  limit 1
$$;
GRANT EXECUTE ON FUNCTION public.find_teacher_by_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_my_teacher_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare c text;
begin
  if not public.has_role(auth.uid(), 'teacher') then return null; end if;
  select teacher_code into c from public.profiles where id = auth.uid();
  if c is null then
    c := public.gen_teacher_code();
    update public.profiles set teacher_code = c where id = auth.uid();
  end if;
  return c;
end;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_my_teacher_code() TO authenticated;

-- 4. Teacher claim now issues a code
CREATE OR REPLACE FUNCTION public.claim_teacher_role(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare ok boolean;
begin
  if auth.uid() is null then return false; end if;
  select exists (select 1 from public.teacher_access_codes where code = _code) into ok;
  if not ok then return false; end if;
  delete from public.user_roles where user_id = auth.uid();
  insert into public.user_roles (user_id, role) values (auth.uid(), 'teacher') on conflict do nothing;
  update public.profiles
    set role = 'teacher',
        student_id = null,
        class_selected = null,
        teacher_id = null,
        teacher_code = coalesce(teacher_code, public.gen_teacher_code())
  where id = auth.uid();
  return true;
end;
$$;

-- 5. Signup metadata now carries teacher code linkage + department
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare _teacher uuid;
begin
  select p.id into _teacher
  from public.profiles p
  where p.role = 'teacher'
    and upper(p.teacher_code) = upper(btrim(coalesce(new.raw_user_meta_data ->> 'teacher_code', '')))
  limit 1;

  insert into public.profiles (id, email, full_name, student_id, phone, class_selected, subject_selected, department, teacher_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'class_selected', ''),
    nullif(new.raw_user_meta_data ->> 'subject_selected', ''),
    nullif(new.raw_user_meta_data ->> 'department', ''),
    _teacher,
    'student'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end;
$$;

-- 6. Students may read their own teacher's profile (name + code)
DROP POLICY IF EXISTS "students read own teacher profile" ON public.profiles;
CREATE POLICY "students read own teacher profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = public.my_teacher_id());

-- 7. Notices
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  class_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own notices"
  ON public.notices FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "students read their teacher notices"
  ON public.notices FOR SELECT TO authenticated
  USING (teacher_id = public.my_teacher_id());

-- 8. Notifications scoped to the teacher's own students
CREATE OR REPLACE FUNCTION public.notify_students_on_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.notifications (user_id, title, body)
  select p.id,
         'নতুন ক্লাস: ' || new.subject_name,
         new.class_name || ' · ' || to_char(new.scheduled_date, 'DD Mon YYYY') || ' · ' ||
         to_char(new.start_time, 'HH24:MI') || '–' || to_char(new.end_time, 'HH24:MI')
  from public.profiles p
  where p.role = 'student'
    and p.teacher_id = new.teacher_id
    and lower(p.class_selected) = lower(new.class_name);
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_students_on_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.notifications (user_id, title, body)
  select p.id, 'নোটিশ: ' || new.title, new.body
  from public.profiles p
  where p.role = 'student'
    and p.teacher_id = new.teacher_id
    and (new.class_name is null or lower(p.class_selected) = lower(new.class_name));
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_notice_created ON public.notices;
CREATE TRIGGER on_notice_created
AFTER INSERT ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.notify_students_on_notice();
