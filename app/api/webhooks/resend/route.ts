import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Resend Inbound Webhook
 * Receives emails sent to *@implicarecivica.ro
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret !== 'whsec_placeholder') {
      const signature = request.headers.get('svix-signature');
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      // TODO: Implement full Svix signature verification when webhook secret is set
    }

    // Use service role to bypass RLS (webhook has no user session)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    const { type, data } = payload;

    // Handle different Resend webhook events
    switch (type) {
      case 'email.received': {
        const { from, to, subject, html, text, message_id, attachments } = data;

        // Find the user by matching the "to" address
        const toEmail = Array.isArray(to) ? to[0] : to;
        const fromEmail = Array.isArray(from) ? from[0] : from;

        // Look up user by their platform email or any known email
        // For now, match by the "to" address pattern
        const { data: matchedEmails } = await supabase
          .from('emails')
          .select('user_id')
          .eq('from_email', toEmail)
          .eq('type', 'sent')
          .limit(1);

        const userId = matchedEmails?.[0]?.user_id;

        if (!userId) {
          console.warn('No user found for inbound email to:', toEmail);
          // Still return 200 to prevent Resend from retrying
          return NextResponse.json({ received: true, matched: false });
        }

        // Save the received email
        const { error: insertError } = await supabase
          .from('emails')
          .insert({
            user_id: userId,
            message_id: message_id || crypto.randomUUID(),
            type: 'received',
            from_email: fromEmail,
            to_email: toEmail,
            subject: subject || '(fără subiect)',
            body: html || text || '',
            attachments: attachments?.map((a: { filename: string; size: number; content_type: string }) => ({
              name: a.filename,
              size: a.size,
              type: a.content_type,
            })) || [],
            processing_status: 'pending',
            is_read: false,
            received_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error saving inbound email:', insertError);
          return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
        }

        return NextResponse.json({ received: true, matched: true });
      }

      case 'email.delivered':
      case 'email.bounced':
      case 'email.complained': {
        // Update email delivery status
        const messageId = data?.email_id;
        if (messageId) {
          const statusMap: Record<string, string> = {
            'email.delivered': 'completed',
            'email.bounced': 'failed',
            'email.complained': 'failed',
          };

          await supabase
            .from('emails')
            .update({
              processing_status: statusMap[type] || 'completed',
              error_log: type === 'email.bounced' ? `Bounce: ${data?.bounce?.type}` : null,
            })
            .eq('message_id', messageId);
        }

        return NextResponse.json({ received: true });
      }

      default:
        return NextResponse.json({ received: true, unhandled: type });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
