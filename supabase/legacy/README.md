# Legacy SQL — do not run

These scripts are the pre-migration-tracking history of the database (initial schema and the
hand-run `migrate-*.sql` files). They are kept for reference only.

- They describe the **old design**: a `submit_report_batch(text, ...)` RPC that trusts a free-text
  employee name, no role checks in the RPC, and no RLS on `task_activities`. Running them on a
  project recreates those weaknesses.
- The source of truth is `supabase/migrations/`, which mirrors the migrations applied to the live
  project, one file per applied version.
- `schema.sql` is the only record of the tables that existed before migration tracking began
  (`profiles`, `employees`, `projects`, `buildings`, `project_tasks`, `report_batches`,
  `report_lines`, `task_categories`, `departments`). It has **not** been verified to replay cleanly
  underneath the current migrations. A proper baseline should be captured from the live project
  with `supabase db dump --schema public`.
