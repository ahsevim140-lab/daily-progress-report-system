# Daily Progress Report System — Full Local Offline Edition

This package runs the application locally with **no Supabase connection and no network requests at runtime**.

## Requirements

- Node.js 20 or newer
- A modern browser

Node.js is used only to serve the already-built local files. The application data is stored in the browser's local persistent storage on the local machine.

## Start on Windows

Double-click `launch-offline.bat`.

## Start on macOS/Linux

Run:

```bash
chmod +x launch-offline.sh
./launch-offline.sh
```

Then open `http://127.0.0.1:3000` if the browser does not open automatically.

## Seeded local accounts

| Username | Password | Role |
| --- | --- | --- |
| manager | manager123 | Manager |
| leader | leader123 | Team leader |
| employee | employee123 | Employee |

Change or manage users from the manager's user-management screen. These credentials are demo defaults and should be changed before operational use.

## Local data model

The offline adapter provides local persistent equivalents for:

- Users and sessions
- Employees and departments
- Projects, buildings, areas, assignments, and tasks
- Daily reports and task history
- Attendance
- Report review lifecycle
- Report snapshots
- Blocker/action queue records

The local database is stored in the browser profile, not in Supabase. Different browsers or browser profiles have separate data.

## Reset

To reset the local database to its seeded state, open the browser developer console and run:

```js
window.__resetOfflineData()
```

This signs out, clears local application data, reseeds the default users, and reloads the app.

## Backup recommendation

Use the browser profile backup or keep a copy of the whole package. For a future production desktop release, the next upgrade would be moving this browser-local database to SQLite with a local API service.
