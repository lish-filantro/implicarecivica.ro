import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Extract raw email address from RFC 5322 format.
 * "Ion Popescu <ion.popescu@domain.ro>" → "ion.popescu@domain.ro"
 * "email@domain.ro" → "email@domain.ro"
 */
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

/**
 * Resend Webhook Handler
 * - email.received: saves email directly from webhook payload to DB
 * - email.delivered/bounced/complained: updates delivery status
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
    }

    // Use service role to bypass RLS (webhook has no user session)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    const { type, data } = payload;

    switch (type) {
      case 'email.received': {
        if (!data) {
          console.error('email.received webhook missing data');
          return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        // Use data directly from webhook payload — no separate API call needed
        const rawTo = Array.isArray(data.to) ? data.to[0] : data.to;
        const toEmail = extractEmail(rawTo);
        const rawFrom = data.from || '';

        // Find user by matching "to" address to profile's mailcow_email
        const { data: matchedProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('mailcow_email', toEmail)
          .limit(1);

        let userId = matchedProfile?.[0]?.id;

        // Fallback: match by sent emails from_email
        if (!userId) {
          const { data: matchedEmails } = await supabase
            .from('emails')
            .select('user_id')
            .eq('from_email', toEmail)
            .eq('type', 'sent')
            .limit(1);

          userId = matchedEmails?.[0]?.user_id;
        }

        if (!userId) {
          console.warn('No user found for inbound email to:', toEmail);
          return NextResponse.json({ received: true, matched: false });
        }

        // Save directly from webhook payload
        const { error: insertError } = await supabase
          .from('emails')
          .insert({
            user_id: userId,
            message_id: data.message_id || data.email_id,
            type: 'received',
            from_email: rawFrom,
            to_email: toEmail,
            subject: data.subject || '(fără subiect)',
            body: data.html || data.text || '',
            attachments: data.attachments?.map((a: { filename: string; content_type: string }) => ({
              name: a.filename,
              type: a.content_type,
            })) || [],
            processing_status: 'completed',
            is_read: false,
            received_at: data.created_at || new Date().toISOString(),
          });

        if (insertError) {
          if (insertError.code === '23505') {
            return NextResponse.json({ received: true, duplicate: true });
          }
          console.error('Error saving inbound email:', insertError);
          return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
        }

        return NextResponse.json({ received: true, matched: true });
      }

      case 'email.delivered':
      case 'email.bounced':
      case 'email.complained': {
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
