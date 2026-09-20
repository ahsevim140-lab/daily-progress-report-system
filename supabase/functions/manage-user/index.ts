import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Applies to new accounts and password resets. Existing shorter passwords keep working until changed.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // Supabase Auth (bcrypt) limit

function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  return null;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function usernameEmail(username: string) {
  return `${normalizeUsername(username)}@dprs.local`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration is incomplete.' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated.' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Not authenticated.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (callerError || callerProfile?.role !== 'manager' || callerProfile?.active === false) {
      return json({ error: 'Manager access required.' }, 403);
    }

    const body = await req.json();
    const action = body.action;

    if (action === 'list') {
      const { data: profiles, error } = await admin
        .from('profiles')
        .select('id, username, display_name, role, active, employee_id, team_leader_id, department, created_at')
        .order('display_name', { ascending: true });
      if (error) throw error;
      return json({ users: profiles || [] });
    }

    if (action === 'create') {
      const username = normalizeUsername(String(body.username || ''));
      const password = String(body.password || '');
      const displayName = String(body.display_name || '').trim();
      const role = ['manager', 'team_leader'].includes(body.role) ? body.role : 'employee';
      const employeeId = body.employee_id || null;
      const teamLeaderId = role === 'employee' ? (body.team_leader_id || null) : null;
      const department = body.department ? String(body.department).trim() : null;

      if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
        return json({ error: 'Username must be 3–32 characters and use only letters, numbers, dot, dash, or underscore.' }, 400);
      }
      const createPasswordError = passwordError(password);
      if (createPasswordError) return json({ error: createPasswordError }, 400);
      if (!displayName) return json({ error: 'Display name is required.' }, 400);

      const { data: existing } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
      if (existing) return json({ error: 'This username is already in use.' }, 409);

      if (teamLeaderId) {
        const { data: leaderProfile } = await admin.from('profiles').select('role').eq('id', teamLeaderId).maybeSingle();
        if (!leaderProfile || leaderProfile.role !== 'team_leader') {
          return json({ error: 'Selected team leader is not valid.' }, 400);
        }
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: usernameEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      });
      if (createError || !created.user) throw createError || new Error('Could not create user.');

      const { error: profileError } = await admin
        .from('profiles')
        .update({ username, display_name: displayName, role, active: true, employee_id: employeeId, team_leader_id: teamLeaderId, department })
        .eq('id', created.user.id);

      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }

      return json({ ok: true });
    }

    if (action === 'update') {
      const id = String(body.id || '');
      const displayName = String(body.display_name || '').trim();
      const role = ['manager', 'team_leader'].includes(body.role) ? body.role : 'employee';
      const employeeId = body.employee_id || null;
      const teamLeaderId = role === 'employee' ? (body.team_leader_id || null) : null;
      const active = body.active !== false;
      const password = body.password ? String(body.password) : '';
      const department = body.department ? String(body.department).trim() : null;

      if (!id || !displayName) return json({ error: 'User and display name are required.' }, 400);
      const updatePasswordError = password ? passwordError(password) : null;
      if (updatePasswordError) return json({ error: updatePasswordError }, 400);
      if (id === user.id && (!active || role !== 'manager')) return json({ error: 'You cannot deactivate or demote your own account.' }, 400);
      if (teamLeaderId === id) return json({ error: 'A user cannot be their own team leader.' }, 400);

      if (teamLeaderId) {
        const { data: leaderProfile } = await admin.from('profiles').select('role').eq('id', teamLeaderId).maybeSingle();
        if (!leaderProfile || leaderProfile.role !== 'team_leader') {
          return json({ error: 'Selected team leader is not valid.' }, 400);
        }
      }

      const { data: updated, error: profileError } = await admin.from('profiles').update({ display_name: displayName, role, active, employee_id: employeeId, team_leader_id: teamLeaderId, department }).eq('id', id).select('id');
      if (profileError) throw profileError;
      if (!updated || updated.length === 0) return json({ error: 'User not found.' }, 404);

      if (password) {
        const { error: resetError } = await admin.auth.admin.updateUserById(id, { password });
        if (resetError) throw resetError;
      }

      return json({ ok: true });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      if (!id || id === user.id) return json({ error: 'You cannot delete your own account.' }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500);
  }
});
