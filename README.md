# Daily Progress Report System

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
