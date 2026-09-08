-- ============================================================================
-- Daily Progress Report System — Supabase schema (v1)
-- Run this once in the Supabase SQL editor on a fresh project.
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. ROLES: every login is either 'employee' (submits reports) or 'manager'
--    (full read access + setup/config control). New signups default to
--    'employee'; promote someone to manager manually (see bottom of file).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('employee', 'manager')),
  username text unique,
  display_name text,
  employee_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user can read own row"
  on public.profiles for select
  using (auth.uid() = id);

-- helper used throughout RLS policies below
create or replace function public.is_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'manager'
  );
$$;

create policy "profiles: manager can read all"
  on public.profiles for select
  using (public.is_manager());

-- auto-create a profile row (role='employee') whenever someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'employee');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Manager user administration is performed by the Supabase Edge Function in
-- supabase/functions/manage-user. It uses the service-role key server-side;
-- that key must NEVER be placed in the React app.


-- ----------------------------------------------------------------------------
-- 2. SETUP / CONFIG TABLES — readable by any logged-in staff member,
--    writable only by managers.
-- ----------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null references public.departments(name) on update cascade
);

alter table public.profiles
  add constraint profiles_employee_fk
  foreign key (employee_id) references public.employees(id) on delete set null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  unique (project_id, name)
);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  main text not null unique,
  subs text[] not null default '{}'
);

-- per project + building + department: progress weight & tracked completion
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  department text not null,
  weight_percent numeric not null default 0 check (weight_percent >= 0 and weight_percent <= 100),
  completion_percent numeric not null default 0 check (completion_percent >= 0 and completion_percent <= 100),
  updated_at timestamptz not null default now(),
  unique (project_id, building_id, department)
);

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.projects enable row level security;
alter table public.buildings enable row level security;
alter table public.task_categories enable row level security;
alter table public.project_tasks enable row level security;

-- read: any authenticated staff member (needed to populate the report form)
create policy "setup: read by any authenticated user" on public.departments for select using (auth.role() = 'authenticated');
create policy "setup: read by any authenticated user" on public.employees for select using (auth.role() = 'authenticated');
create policy "setup: read by any authenticated user" on public.projects for select using (auth.role() = 'authenticated');
create policy "setup: read by any authenticated user" on public.buildings for select using (auth.role() = 'authenticated');
create policy "setup: read by any authenticated user" on public.task_categories for select using (auth.role() = 'authenticated');
create policy "setup: read by any authenticated user" on public.project_tasks for select using (auth.role() = 'authenticated');

-- write: manager only
create policy "setup: write by manager" on public.departments for all using (public.is_manager()) with check (public.is_manager());
create policy "setup: write by manager" on public.employees for all using (public.is_manager()) with check (public.is_manager());
create policy "setup: write by manager" on public.projects for all using (public.is_manager()) with check (public.is_manager());
create policy "setup: write by manager" on public.buildings for all using (public.is_manager()) with check (public.is_manager());
create policy "setup: write by manager" on public.task_categories for all using (public.is_manager()) with check (public.is_manager());
create policy "setup: write by manager" on public.project_tasks for all using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------------------
-- 3. REPORTS — a "batch" is one submission (one employee, one project, one
--    building, one visit); it holds one or more task "lines" underneath.
--    Regular employees never write these tables directly — they call the
--    submit_report_batch() function below, which validates and updates
--    project_tasks completion atomically.
-- ----------------------------------------------------------------------------
create table public.report_batches (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  project_id uuid not null references public.projects(id),
  building_id uuid not null references public.buildings(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.report_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.report_batches(id) on delete cascade,
  department text not null,
  task text not null,
  percentage numeric not null check (percentage >= 0 and percentage <= 100),
  previous_percentage numeric not null default 0,
  flag text not null default 'none' check (flag in ('none', 'stalled', 'regressed')),
  note text,
  created_at timestamptz not null default now(),
  constraint note_required_if_flagged check (flag = 'none' or (note is not null and length(trim(note)) > 0))
);

alter table public.report_batches enable row level security;
alter table public.report_lines enable row level security;

-- only managers browse the report log directly; employees submit via the
-- security-definer function below, which bypasses these read-only policies
create policy "reports: read by manager" on public.report_batches for select using (public.is_manager());
create policy "reports: read by manager" on public.report_lines for select using (public.is_manager());

-- ----------------------------------------------------------------------------
-- 4. submit_report_batch() — the only way employees write report data.
--    Runs as the function owner (bypasses RLS), so it can safely:
--      - insert the batch + its lines
--      - read + update each touched project_tasks row's completion_percent
--      - compute the stalled/regressed flag server-side (not trusted from client)
-- ----------------------------------------------------------------------------
create or replace function public.submit_report_batch(
  p_employee_name text,
  p_project_id uuid,
  p_building_id uuid,
  p_lines jsonb -- [{ "department": "...", "task": "...", "percentage": 40, "note": "..." }, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_line jsonb;
  v_current numeric;
  v_flag text;
  v_dept text;
  v_pct numeric;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into report_batches (employee_name, project_id, building_id, created_by)
  values (p_employee_name, p_project_id, p_building_id, auth.uid())
  returning id into v_batch_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_dept := v_line->>'department';
    v_pct := (v_line->>'percentage')::numeric;
    v_note := nullif(v_line->>'note', '');

    -- lock (or create) the tracked row for this project+building+department
    select completion_percent into v_current
      from project_tasks
      where project_id = p_project_id and building_id = p_building_id and department = v_dept
      for update;

    if not found then
      insert into project_tasks (project_id, building_id, department, weight_percent, completion_percent)
      values (p_project_id, p_building_id, v_dept, 0, 0);
      v_current := 0;
    end if;

    if v_pct > v_current then
      v_flag := 'none';
    elsif v_pct = v_current then
      v_flag := 'stalled';
    else
      v_flag := 'regressed';
    end if;

    if v_flag != 'none' and (v_note is null) then
      raise exception 'A note is required when % is stalled or regressed for department %', v_pct, v_dept;
    end if;

    insert into report_lines (batch_id, department, task, percentage, previous_percentage, flag, note)
    values (v_batch_id, v_dept, v_line->>'task', v_pct, v_current, v_flag, v_note);

    update project_tasks
      set completion_percent = v_pct, updated_at = now()
      where project_id = p_project_id and building_id = p_building_id and department = v_dept;
  end loop;

  return v_batch_id;
end;
$$;

grant execute on function public.submit_report_batch(text, uuid, uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Seed data — mirrors what the app currently ships as defaults.
--    Edit or delete before running if you'd rather start empty.
-- ----------------------------------------------------------------------------
insert into public.departments (name) values ('معماري'), ('مدني'), ('كهرباء'), ('ميكانيك');

insert into public.task_categories (main, subs) values
  ('اجتماع', array['محضر متطلبات']),
  ('وضع راهن', array['رفع', 'رسم', 'اخراج']),
  ('تدقيق', array['تدقيق : كميات', 'تدقيق : مخططات', 'تدقيق : قائد الفريق', 'تدقيق : رئيس القسم', 'تدقيق : قسم الجودة']),
  ('عام', array['جمع وتنسيق الملفات', 'ملف الدراسة التقنية']),
  ('تدريب', array['Etaps', 'Revit', 'Autocad', 'D5', 'Robot', 'تصميم انشائي', 'تصميم معماري', 'تصميم كهربائي', 'تصميم ميكانيكي', 'أخرى']),
  ('معماري', array['تصميم', 'اخراج مخططات', 'حساب كميات معمارية', 'حساب كميات انشائية', 'تعبئة جداول كميات', 'تعديل رسم بعد التدقيق', 'تعديل كميات بعد التدقيق']),
  ('مدني', array['تصميم', 'اخراج مخططات', 'حساب كميات انشائية', 'حساب كميات معمارية', 'تعبئة جداول كميات انشائية', 'تعديل رسم بعد التدقيق', 'تعديل كميات بعد التدقيق']),
  ('كهرباء', array['تيار قوي : مآخذ', 'تيار قوي : إنارة', 'تيار قوي : تغذية احمال ميكانيكية', 'تيار قوي : لوحات + مخطط واحدي', 'تيار قوي : حماية صواعق', 'تيار قوي : وصل الكابلات', 'تيار ضعيف: هاتف + تلفزيون +داتا', 'تيار ضعيف: انذار حريق', 'تيار ضعيف: كاميرات', 'نظام آخر ( يذكر في الملاحظات )', 'اخراج مخططات', 'حساب كميات كهربائية', 'تعبئة جداول كميات كهربائية', 'تعديل رسم بعد التدقيق', 'تعديل كميات بعد التدقيق']),
  ('ميكانيك', array['صحية : مياه حلوة', 'صحية : مياه مالحة', 'تهوية', 'تكييف', 'تدفئة', 'اطفاء حريق', 'نظام آخر ( يذكر في الملاحظات )', 'اخراج مخططات', 'حساب كميات ميكانيكية', 'تعبئة جداول كميات ميكانيكية', 'تعديل رسم بعد التدقيق', 'تعديل كميات بعد التدقيق']);

-- NOTE: employees / projects / buildings are intentionally left for you to
-- add from the Manager → إدارة القوائم screen once the app is running,
-- since that data is specific to your company and shouldn't live in a
-- SQL file that might end up in a public repo.

-- ----------------------------------------------------------------------------
-- 6. Authentication notes
--    The app uses username + password in its UI. Usernames are mapped to
--    internal non-mailbox addresses such as username@dprs.local for Supabase
--    Auth. These addresses are never shown to staff and no real email is needed.
--    Create the initial manager account once in Supabase Auth with a .dprs.local
--    email, confirm it manually, then set its profile username/display_name and
--    role='manager'. After that, the manager can create all other accounts from
--    the Manager -> User Management screen.
-- ----------------------------------------------------------------------------
