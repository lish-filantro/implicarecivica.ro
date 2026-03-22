import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DAILY_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Parametrul "email" este obligatoriu' },
        { status: 400 },
      );
    }

    // Count requests sent today by this user to this institution email
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('institution_email', email)
      .gte('date_sent', today.toISOString());

    if (countError) {
      console.error('Rate limit check error:', countError);
      return NextResponse.json({ error: 'Eroare la verificare' }, { status: 500 });
    }

    const sentToday = count ?? 0;

    return NextResponse.json({
      sent_today: sentToday,
      remaining: Math.max(0, DAILY_LIMIT - sentToday),
      limit: DAILY_LIMIT,
    });
  } catch (error) {
    console.error('Rate limit check error:', error);
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 });
  }
}
