import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DAILY_LIMIT = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const { questions } = await request.json();

    if (!questions?.length) {
      return NextResponse.json(
        { error: 'Câmpul "questions" este obligatoriu și trebuie să conțină cel puțin o întrebare' },
        { status: 400 },
      );
    }

    // Fetch existing session — must belong to this user
    const { data: session, error: sessionError } = await supabase
      .from('request_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Sesiunea nu a fost găsită' }, { status: 404 });
    }

    // Check daily rate limit for this user + institution email
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('institution_email', session.institution_email)
      .gte('date_sent', today.toISOString());

    if (countError) {
      console.error('Rate limit count error:', countError);
      return NextResponse.json({ error: 'Eroare la verificarea limitei' }, { status: 500 });
    }

    const sentToday = count ?? 0;
    const remaining = Math.max(0, DAILY_LIMIT - sentToday);

    if (questions.length > remaining) {
      return NextResponse.json({
        error: `Ai atins limita de cereri către această instituție azi. Mai poți trimite ${remaining}.`,
        sent_today: sentToday,
        remaining,
        limit: DAILY_LIMIT,
      }, { status: 429 });
    }

    // Create individual requests linked to existing session
    const requestInserts = questions.map((question: string) => ({
      user_id: user.id,
      session_id: session.id,
      institution_name: session.institution_name,
      institution_email: session.institution_email,
      subject: session.subject,
      request_body: question,
      status: 'pending' as const,
      date_initiated: new Date().toISOString(),
    }));

    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .insert(requestInserts)
      .select();

    if (requestsError) {
      console.error('Requests create error:', requestsError);
      return NextResponse.json({ error: 'Eroare la crearea cererilor' }, { status: 500 });
    }

    // Update session total_requests count
    await supabase
      .from('request_sessions')
      .update({
        total_requests: (session.total_requests ?? 0) + questions.length,
      })
      .eq('id', session.id);

    return NextResponse.json({
      success: true,
      session,
      requests: requests || [],
    });
  } catch (error) {
    console.error('Add requests error:', error);
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 });
  }
}
