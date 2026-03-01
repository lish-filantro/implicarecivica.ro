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
 * - email.received: fetches full email content via Resend API, saves to DB
 * - email.delivered/bounced/complained: updates delivery status
 *
 * IMPORTANT: Resend webhooks only send metadata, NOT email body.
 * We must call GET /emails/receiving/{id} to get the full content.
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

    switch (type) {
      case 'email.received': {
        // Resend docs: webhook payload has data.email_id
        const emailId = data?.email_id;
        if (!emailId) {
          console.error('email.received webhook missing email_id:', JSON.stringify(data));
          return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
        }

        // Fetch full email content from Resend API
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
          console.error('RESEND_API_KEY not configured');
          return NextResponse.json({ error: 'Server config error' }, { status: 500 });
        }

        const emailResponse = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { 'Authorization': `Bearer ${resendApiKey}` },
        });

        if (!emailResponse.ok) {
          console.error('Failed to fetch email from Resend:', emailResponse.status, await emailResponse.text());
          return NextResponse.json({ error: 'Failed to fetch email content' }, { status: 502 });
        }

        const email = await emailResponse.json();

        // Parse "to" — extract raw email address for user matching
        const rawTo = Array.isArray(email.to) ? email.to[0] : email.to;
        const toEmail = extractEmail(rawTo);

        // Parse "from" — keep full string (with display name) for storage
        const rawFrom = typeof email.from === 'string' ? email.from : email.from?.email || String(email.from);

        // 1) Find user by matching "to" address to profile's mailcow_email
        const { data: matchedProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('mailcow_email', toEmail)
          .limit(1);

        let userId = matchedProfile?.[0]?.id;

        // 2) Fallback: match by sent emails from_email
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

        // Save the received email with full content
        const { error: insertError } = await supabase
          .from('emails')
          .insert({
            user_id: userId,
            message_id: email.message_id || emailId,
            type: 'received',
            from_email: rawFrom,
            to_email: toEmail,
            subject: email.subject || '(fără subiect)',
            body: email.html || email.text || '',
            attachments: email.attachments?.map((a: { filename: string; content_type: string }) => ({
              name: a.filename,
              type: a.content_type,
            })) || [],
            processing_status: 'completed',
            is_read: false,
            received_at: email.created_at || new Date().toISOString(),
          });

        if (insertError) {
          // Handle duplicate (already processed)
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
