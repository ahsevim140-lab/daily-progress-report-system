-- Run this AFTER the original schema.sql has already been run.
-- It changes the existing profiles table to support username/password login
-- managed from the application. It does not require real email addresses.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists employee_id uuid references public.employees(id) on delete set null;
alter table public.profiles add column if not exists active boolean not null default true;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

-- IMPORTANT: after running this migration, create ONE initial manager in
-- Supabase Auth using an internal address such as manager@dprs.local and
-- confirm it manually. Then run the example below with that user's UUID.
--
-- update public.profiles
-- set username = 'manager', display_name = 'المدير', role = 'manager', active = true
-- where id = '<MANAGER_AUTH_USER_UUID>';
