-- Hardening pass (security advisor findings + review of the online contract).
-- Idempotent: safe to run more than once.

-- 1. task_activities has policies ("no direct insert", "scoped read") but RLS was never enabled:
--    20260920091341_online_offline_contract created the table and its policies without
--    `enable row level security`, so the table was open to the anon/authenticated API roles.
--    SECURITY DEFINER functions are owned by postgres (bypassrls), so submit_report and
--    override_task_completion keep writing to it.
alter table public.task_activities enable row level security;

-- 2. submit_report_batch is the pre-contract RPC: it trusts a free-text employee name and does no
--    role / assignment / today-only checks. The frontend only calls submit_report.
drop function if exists public.submit_report_batch(text, uuid, uuid, jsonb);

-- 3. Function grants. Supabase grants EXECUTE to anon/authenticated directly, so
--    `revoke ... from public` alone does not close them.
--    is_manager() / is_team_leader() are intentionally left alone: RLS policies evaluate them as
--    the calling role.
revoke execute on function public.submit_report(jsonb, date, uuid) from public, anon;
revoke execute on function public.override_task_completion(uuid, numeric, text) from public, anon;
grant execute on function public.submit_report(jsonb, date, uuid) to authenticated;
grant execute on function public.override_task_completion(uuid, numeric, text) to authenticated;

-- Not called by the client; only invoked from a trigger function.
revoke execute on function public.recalculate_project_building_weights(uuid) from public, anon, authenticated;

-- Trigger functions: EXECUTE is only checked at CREATE TRIGGER time, so the triggers keep firing.
revoke execute on function public.enforce_project_assignment() from public, anon, authenticated;
revoke execute on function public.enforce_report_line_department() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_project_assignment_actor() from public, anon, authenticated;
revoke execute on function public.recalculate_weights_after_area_change() from public, anon, authenticated;
