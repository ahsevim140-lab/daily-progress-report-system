import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

// ---------------------------------------------------------------------------
// Offline mode switch
//
// This build is an OFFLINE MODEL: left unset (or "true"), the app runs
// entirely against an in-memory/localStorage mock — no network, no Supabase
// project required — and the UI shows a permanent OFFLINE banner.
// Real-Supabase mode (VITE_OFFLINE_MODE=false) is NOT kept in step with the
// offline model yet (see README, "Offline scope"). Default seeded logins:
//   manager  / manager123    (manager role, not linked to an employee)
//   leader   / leader123     (team_leader role, linked to an employee)
//   employee / employee123   (employee role, in the leader's team)
// Run window.__resetOfflineData() in the browser console to wipe local
// offline data and reseed it.
// ---------------------------------------------------------------------------
export const offlineMode = import.meta.env.VITE_OFFLINE_MODE !== 'false';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!offlineMode && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in, or set VITE_OFFLINE_MODE=true.'
  );
}

export const supabase: any = offlineMode ? mockSupabase : createClient(supabaseUrl, supabaseAnonKey);

if (offlineMode && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[DPRS] Running in OFFLINE mode — all data is local/mock. Set VITE_OFFLINE_MODE=false in .env.local to use real Supabase.');
}
