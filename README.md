# Daily Progress Report System

> **Current scope: offline model.** The app runs entirely in the browser against
> `src/lib/mockSupabase.ts`, and shows an OFFLINE / DEMO banner. In this mode the mock **is**
> the database, so the rules below are enforced there and covered by `npm test`.
> Real-Supabase mode (`VITE_OFFLINE_MODE=false`) has **not** been brought in step yet.

## Running it on a new Windows PC

Double-click **`launch.bat`** (`start.bat` just calls it). It:

1. checks for Node.js 20.19+/22.12+ and, if missing, installs it (winget, or a checksum-verified
   download from nodejs.org as a fallback; Windows shows one permission prompt);
2. installs the npm dependencies with `npm ci` on first run, and again whenever `node_modules` is
   missing/incomplete/copied from another machine or `package-lock.json` changed;
3. starts the dev server and opens the browser (port 3000; if it is busy, the next free port).

It needs internet access the first time. Extract the zip before running it.

## Offline model: seeded logins

| Username | Password | Role | Notes |
| --- | --- | --- | --- |
| `manager` | `manager123` | manager | Not linked to an employee; reports only *on behalf of* a chosen employee |
| `leader` | `leader123` | team_leader | Linked to an employee; the team leader of `employee` |
| `employee` | `employee123` | employee | Linked to an employee; reports as themselves |

Reset local data from the browser console with `window.__resetOfflineData()`.

## Rules the backend enforces (offline: in `mockSupabase.ts`)

- **Identity** comes from the signed-in account's linked employee, never from a form field.
  Only a manager may report on behalf of someone else; that is stored as `submitted_by`.
- **`submit_report`** is all-or-nothing and checks: the building belongs to the project, the
  project still accepts progress (not completed / stopped / not wanted), the task is not assigned
  to someone else or cancelled, percentage 0–100, hours 0–24, a reason when progress is unchanged
  or reduced, and a work date that is not in the future.
- **History**: `task_activities` is the one record of a change (linked to its report line by
  `report_line_id`). Report lines store no percentages of their own; previous/new/flag are read
  from the activity. `project_tasks` holds only the current state.
- **Dates**: `work_date` (when the work happened) is separate from `created_at` (when it was submitted).
- **Today-only entry**: the report entry screen no longer lets staff choose a work date; submissions are recorded for the current local day only.
- **Employee project view**: employees have a **My Projects** tab showing projects that contain tasks assigned to them, with progress calculated from their assigned tasks.
- **Manager override** (`override_task_completion`) is manager-only, needs a reason, and is recorded as an `override` activity. No screen calls it yet.
- **Reads**: reports are visible to the manager (all), a team leader (own team, own projects, own
  reports) and an employee (own). `manage-user` is manager-only, as in the real Edge Function.

## Not done yet (deliberately deferred)

- Real Supabase: `schema.sql` and the migrations still describe the old design (role check without
  `team_leader`, manager-only report reads, `submit_report(text, jsonb)` taking an employee name,
  `security definer` trusting the caller). The new `submit_report` / `override_task_completion`
  contracts and RLS need writing before switching the flag. Note the GitHub Pages workflow builds
  without `VITE_OFFLINE_MODE=false`, so the deployed site is the offline model.
- Write permissions in the mock are still open to any signed-in user (only reads and `manage-user` are scoped).
- Team-leader project scope is "projects I created", not "projects I lead".
- A report back-dated before a newer report for the same task still overwrites the task's current percentage.
- Project weights are only warned about, not required to total 100% before a project runs.

React + TypeScript + Vite frontend with Supabase backend.

## Login model

The application uses **username + password** in its interface. Staff do not need
real email addresses and do not need access to the Supabase dashboard.

Supabase Auth still handles the actual password authentication securely. Internally,
the app maps a username such as `ahmad` to `ahmad@dprs.local`; this internal address
is never shown to staff and no mailbox is required.

Managers create and manage users from **لوحة المدير → إدارة القوائم → إدارة المستخدمين**.
The manager can create employee/manager accounts, link an account to an employee,
activate/deactivate accounts, and reset passwords.

The user-management Edge Function uses the Supabase service-role key **only on the
server side**. Never put the service-role/secret key in `.env` for the React app or
in GitHub Pages secrets prefixed with `VITE_`.

## First-time setup

1. Run `supabase/schema.sql` on a fresh Supabase project.
2. If you already ran the older schema, run `supabase/migrate-username-login.sql` instead.
3. Create the first manager once in Supabase Auth using an internal address such as
   `manager@dprs.local`, confirm it manually, then set that user's profile role to
   `manager` and username to `manager` using the example in the migration file.
4. Deploy `supabase/functions/manage-user` as a Supabase Edge Function. The function
   already receives the Supabase server secrets automatically; it must remain server-side.
5. The manager can then create all normal users from the application. No further Auth
   dashboard work is needed for day-to-day user management.

## Environment variables

For the React app, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — despite the variable name, use the project's Supabase
  **Publishable key** here.

Do not put a Supabase Secret/service-role key in the frontend.
