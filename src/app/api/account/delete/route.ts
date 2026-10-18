import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OWNED_TABLES = ['audit_events', 'treatment_checkins', 'coach_sessions', 'profiles'] as const;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || !token) {
    // Local-only mode: nothing exists server-side; the client purges localStorage itself.
    return NextResponse.json({ deleted: true, mode: 'local_only', message: 'Local browser data cleared.' });
  }

  // Act AS the user (anon key + their JWT) so row-level security scopes every delete to their own rows.
  // The service-role key is deliberately not used here: it would bypass RLS for no benefit.
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Unauthorized session token.' }, { status: 401 });
  }
  const userId = userRes.user.id;

  const failed: string[] = [];
  for (const table of OWNED_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) failed.push(table);
  }

  if (failed.length > 0) {
    return NextResponse.json({ error: 'Failed to delete cloud records.', failedTables: failed }, { status: 500 });
  }
  return NextResponse.json({
    deleted: true,
    mode: 'supabase_and_local',
    message: 'All cloud and local records for your account have been deleted.',
  });
}
