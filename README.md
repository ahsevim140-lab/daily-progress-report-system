# Daily Progress Report System

> **Two modes.** The app runs either against a Supabase project (**online**) or entirely in the
> browser against `src/lib/mockSupabase.ts` (**offline**, with an OFFLINE / DEMO banner).
> The mode is chosen at build time by `VITE_OFFLINE_MODE`: unset or `true` = offline mock,
> `false` = real Supabase. The GitHub Pages deploy (`.github/workflows/deploy.yml`) builds with
> `VITE_OFFLINE_MODE=false`, so the published site is the **online** app. `launch.bat` and
> `npm run dev` without an `.env.local` run the **offline** mock.
> In offline mode the mock **is** the database, so the rules below are enforced there and covered
> by `npm test`; online, the same rules are enforced by Postgres (RPCs + RLS, see
> `supabase/migrations/`).

## Running it on a new Windows PC

Double-click **`launch.bat`** (`start.bat` just calls it). It:

1. checks for Node.js 20.19+/22.12+ and, if missing, installs it (winget, or a checksum-verified
   download from nodejs.org as a fallback; Windows shows one permission prompt);
2. installs the npm dependencies with `npm ci` on first run, and again whenever `node_modules` is
   missing/incomplete/copied from another machine or `package-lock.json` changed;
3. starts the dev server and opens the browser (port 3000; if it is busy, the next free port).

It needs internet access the first time. Extract the zip before running it.

## Offline mode: seeded logins (mock only)

| Username | Password | Role | Notes |
| --- | --- | --- | --- |
| `manager` | `manager123` | manager | Not linked to an employee; reports only *on behalf of* a chosen employee |
| `leader` | `leader123` | team_leader | Linked to an employee; the team leader of `employee` |
| `employee` | `employee123` | employee | Linked to an employee; reports as themselves |

These accounts exist **only in the offline mock**. Never create them in a real Supabase project.

Reset local data from the browser console with `window.__resetOfflineData()`.

## Rules the backend enforces (offline: in `mockSupabase.ts`; online: in Postgres)

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

## Known limitations

- Write permissions in the offline mock are still open to any signed-in user (only reads and
  `manage-user` are scoped). Online, writes are governed by RLS and the RPCs.
- Team-leader project scope is "projects I created", not "projects I lead".
- A report back-dated before a newer report for the same task still overwrites the task's current percentage.
- Project weights are only warned about, not required to total 100% before a project runs.
- The tests in `tests/` run against the offline mock only; nothing tests the real Postgres RPCs or
  RLS policies yet, so the mock and the SQL can drift apart.
- A brand-new Supabase project cannot yet be rebuilt from this repo alone (see *Database* below).

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

## Database

`supabase/migrations/` mirrors the migrations applied to the live project, one file per applied
version (same version numbers and same SQL). Rules:

- Never edit a migration that has been applied. Add a new one (`supabase migration new <name>`).
- `20260920121351_harden_rls_and_function_grants.sql` enables RLS on `task_activities`, drops the
  legacy `submit_report_batch` RPC and revokes `anon` execute on internal functions.
- `supabase/legacy/` holds the pre-tracking schema and hand-run scripts. **Do not run them**; they
  recreate the old, weaker design (see `supabase/legacy/README.md`).
- The tables created before migration tracking began are only described by
  `supabase/legacy/schema.sql`, which has not been verified to replay under the current
  migrations. Capture a real baseline with `supabase db dump --schema public` before relying on
  this repo to create a new project.

## First-time setup (existing project)

1. Apply the migrations in `supabase/migrations/` in order (`supabase db push`).
2. Create the first manager once in Supabase Auth using an internal address such as
   `manager@dprs.local`, confirm it manually, then set that user's profile role to
   `manager` and username to `manager` (example in `supabase/legacy/migrate-username-login.sql`).
3. Deploy `supabase/functions/manage-user` as a Supabase Edge Function. The function
   already receives the Supabase server secrets automatically; it must remain server-side.
4. The manager can then create all normal users from the application. No further Auth
   dashboard work is needed for day-to-day user management.

## CI / deploy

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, `npm run lint`,
`npm test`, `npm run build` (with `VITE_OFFLINE_MODE=false`), then publishes to GitHub Pages.
It needs the repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable
key, never a service-role key).

## Environment variables

For the React app, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — despite the variable name, use the project's Supabase
  **Publishable key** here.

Do not put a Supabase Secret/service-role key in the frontend.
