alter table public.task_categories add column if not exists department text;
create index if not exists task_categories_department_idx on public.task_categories(department);
