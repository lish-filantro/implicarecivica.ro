import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const { name, subject, institution_name, institution_email, conversation_id, questions } = await request.json();

    if (!subject || !institution_name || !questions?.length) {
      return NextResponse.json(
        { error: 'Câmpuri lipsă: subject, institution_name, questions sunt obligatorii' },
        { status: 400 },
      );
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('request_sessions')
      .insert({
        user_id: user.id,
        name: name || null,
        subject,
        institution_name,
        institution_email: institution_email || null,
        conversation_id: conversation_id || null,
        total_requests: questions.length,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session create error:', sessionError);
      return NextResponse.json({ error: 'Eroare la crearea sesiunii' }, { status: 500 });
    }

    // Create individual requests (one per question)
    const requestInserts = questions.map((question: string) => ({
      user_id: user.id,
      session_id: session.id,
      institution_name,
      institution_email: institution_email || null,
      subject,
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

    return NextResponse.json({
      success: true,
      session,
      requests: requests || [],
    });
  } catch (error) {
    console.error('Session create error:', error);
    return NextResponse.json({ error: 'Eroare internă la crearea sesiunii' }, { status: 500 });
  }
}
