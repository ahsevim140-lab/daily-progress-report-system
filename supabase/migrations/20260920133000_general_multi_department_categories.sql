alter table public.task_categories add column if not exists departments text[] not null default '{}';
alter table public.task_categories add column if not exists is_general boolean not null default false;
update public.task_categories set departments = array[department] where coalesce(array_length(departments, 1), 0) = 0 and department is not null;
create index if not exists task_categories_departments_gin_idx on public.task_categories using gin(departments);
