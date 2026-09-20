CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_no_time_overlap
  EXCLUDE USING gist (
    teacher_id WITH =,
    scheduled_date WITH =,
    tsrange(('2000-01-01'::timestamp + start_time), ('2000-01-01'::timestamp + end_time), '[)') WITH &&
  );