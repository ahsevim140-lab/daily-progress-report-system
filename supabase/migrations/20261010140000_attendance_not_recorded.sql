-- Attendance parity: an unrecorded day must not be interpreted as present.
-- The UI also synthesizes this status for rows that do not yet exist.
alter table public.attendance
  drop constraint if exists attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('not_recorded', 'present', 'late', 'day_off', 'hours_off', 'absent'));

comment on column public.attendance.status is
  'Attendance state. not_recorded means the manager has not confirmed a status for this employee/date.';
