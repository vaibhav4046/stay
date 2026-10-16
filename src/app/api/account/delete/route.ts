import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const supabase = getSupabaseServerAdminClient();
  if (!supabase || !token) {
    // Local-only mode: client purges localStorage directly
    return NextResponse.json({
      deleted: true,
      mode: 'local_only',
      message: 'Local browser data cleared.',
    });
  }

  try {
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Unauthorized session token.' }, { status: 401 });
    }

    const userId = userRes.user.id;

    await supabase.from('audit_events').delete().eq('user_id', userId);
    await supabase.from('treatment_checkins').delete().eq('user_id', userId);
    await supabase.from('coach_sessions').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('user_id', userId);

    return NextResponse.json({
      deleted: true,
      mode: 'supabase_and_local',
      message: 'All cloud and local records for your account have been permanently deleted.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete cloud account records.' },
      { status: 500 }
    );
  }
}
