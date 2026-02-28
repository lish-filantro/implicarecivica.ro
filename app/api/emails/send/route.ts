import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resend } from '@/lib/resend';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const { to, subject, body, request_id, parent_email_id } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Câmpuri lipsă: to, subject, body sunt obligatorii' },
        { status: 400 }
      );
    }

    // Get user's platform email from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, mailcow_email')
      .eq('id', user.id)
      .single();

    if (!profile?.mailcow_email) {
      return NextResponse.json(
        { error: 'Nu ai o adresă de email de platformă asociată contului. Contactează suportul.' },
        { status: 400 }
      );
    }

    const displayName = profile.display_name || 'Utilizator';
    const fromEmail = `${displayName} <${profile.mailcow_email}>`;

    // Send via Resend
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      html: body,
      headers: {
        ...(request_id ? { 'X-Request-ID': request_id } : {}),
      },
    });

    if (resendError) {
      console.error('Resend error:', resendError);
      return NextResponse.json(
        { error: `Eroare la trimitere: ${resendError.message}` },
        { status: 500 }
      );
    }

    // Save email record in database
    const { data: emailRecord, error: dbError } = await supabase
      .from('emails')
      .insert({
        user_id: user.id,
        request_id: request_id || null,
        parent_email_id: parent_email_id || null,
        message_id: resendData?.id || crypto.randomUUID(),
        type: 'sent',
        category: 'trimise',
        from_email: profile.mailcow_email,
        to_email: to,
        subject,
        body,
        processing_status: 'completed',
        is_read: true,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error (email sent but not saved):', dbError);
      // Email was sent successfully even if DB save failed
      return NextResponse.json({
        success: true,
        resend_id: resendData?.id,
        warning: 'Email trimis, dar nu a fost salvat în baza de date',
      });
    }

    // If linked to a request, update the request status
    if (request_id) {
      await supabase
        .from('requests')
        .update({
          status: 'pending',
          date_sent: new Date().toISOString(),
        })
        .eq('id', request_id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      email: emailRecord,
      resend_id: resendData?.id,
    });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Eroare internă la trimiterea emailului' },
      { status: 500 }
    );
  }
}
