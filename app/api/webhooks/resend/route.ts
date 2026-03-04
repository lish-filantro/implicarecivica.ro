import { NextRequest, NextResponse, after } from 'next/server';
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
 * Try to fetch full email content from Resend API.
 * Tries multiple endpoints since docs vary.
 */
async function fetchEmailContent(emailId: string, apiKey: string) {
  const endpoints = [
    `https://api.resend.com/emails/${emailId}`,
    `https://api.resend.com/emails/receiving/${emailId}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Fetched email content from ${url}, keys:`, Object.keys(data));
        return data;
      }
      console.warn(`${url} returned ${res.status}`);
    } catch (err) {
      console.warn(`${url} fetch error:`, err);
    }
  }
  return null;
}

/**
 * Detect parent email via In-Reply-To / References headers.
 * Returns the parent email's UUID from our DB, or null.
 */
async function detectParentEmail(
  headers: Record<string, string> | undefined,
  supabase: ReturnType<typeof createServerClient>,
): Promise<string | null> {
  if (!headers) return null;

  // In-Reply-To is the most direct signal
  const inReplyTo = headers['in-reply-to'] || headers['In-Reply-To'];
  // References contains the full thread chain
  const references = headers['references'] || headers['References'];

  const messageIdsToCheck: string[] = [];

  if (inReplyTo) {
    // Clean angle brackets: <msg-id@domain> → msg-id@domain
    const cleaned = inReplyTo.replace(/[<>]/g, '').trim();
    if (cleaned) messageIdsToCheck.push(cleaned);
  }

  if (references) {
    // References can contain multiple message IDs separated by spaces
    const refs = references.split(/\s+/).map((r) => r.replace(/[<>]/g, '').trim()).filter(Boolean);
    for (const ref of refs) {
      if (!messageIdsToCheck.includes(ref)) {
        messageIdsToCheck.push(ref);
      }
    }
  }

  if (messageIdsToCheck.length === 0) return null;

  // Look for any of these message IDs in our DB
  for (const msgId of messageIdsToCheck) {
    const { data } = await supabase
      .from('emails')
      .select('id')
      .eq('message_id', msgId)
      .limit(1);

    if (data && data.length > 0) {
      console.log(`[Thread] Found parent email ${data[0].id} via message_id ${msgId}`);
      return data[0].id;
    }
  }

  return null;
}

/**
 * Fetch attachments from Resend API, download them, and save to Supabase Storage.
 * Returns array of saved attachment metadata (with storage paths).
 */
async function saveAttachments(
  resendEmailId: string,
  apiKey: string,
  userId: string,
  emailId: string,
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ name: string; type: string; size: number; path: string }[]> {
  const saved: { name: string; type: string; size: number; path: string }[] = [];

  try {
    // Fetch attachment list with download URLs from Resend
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${resendEmailId}/attachments`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      console.warn(`[Attachments] API returned ${res.status}`);
      return saved;
    }

    const attachmentList = await res.json();
    const items = Array.isArray(attachmentList) ? attachmentList : attachmentList?.data || [];

    if (items.length === 0) return saved;

    console.log(`[Attachments] Found ${items.length} attachment(s)`);

    for (const att of items) {
      if (!att.download_url) continue;

      try {
        // Download file from signed CloudFront URL
        const fileRes = await fetch(att.download_url);
        if (!fileRes.ok) {
          console.warn(`[Attachments] Download failed for ${att.filename}: ${fileRes.status}`);
          continue;
        }

        const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

        // Max 50MB
        if (fileBuffer.length > 50 * 1024 * 1024) {
          console.warn(`[Attachments] ${att.filename} too large (${fileBuffer.length} bytes), skipping`);
          continue;
        }

        const storagePath = `${userId}/${emailId}/${att.filename || 'attachment'}`;

        const { error } = await supabase.storage
          .from('email-attachments')
          .upload(storagePath, fileBuffer, {
            contentType: att.content_type || 'application/octet-stream',
            upsert: true,
          });

        if (error) {
          console.error(`[Attachments] Upload failed for ${att.filename}:`, error.message);
          continue;
        }

        console.log(`[Attachments] Saved ${att.filename} (${fileBuffer.length} bytes)`);
        saved.push({
          name: att.filename || 'attachment',
          type: att.content_type || 'application/octet-stream',
          size: att.size || fileBuffer.length,
          path: storagePath,
        });
      } catch (dlErr: any) {
        console.error(`[Attachments] Error processing ${att.filename}:`, dlErr.message);
      }
    }
  } catch (err: any) {
    console.error('[Attachments] Fetch error:', err.message);
  }

  return saved;
}

/**
 * Resend Webhook Handler
 * - email.received: saves email + PDF attachments + thread detection, marks for processing
 * - email.delivered/bounced/complained: updates delivery status
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
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
          return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        console.log('email.received payload keys:', Object.keys(data));

        const rawTo = Array.isArray(data.to) ? data.to[0] : data.to;
        const toEmail = extractEmail(rawTo);
        const rawFrom = data.from || '';

        // Find user by mailcow_email
        const { data: matchedProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('mailcow_email', toEmail)
          .limit(1);

        let userId = matchedProfile?.[0]?.id;

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

        // Try to get full email content (with body) from Resend API
        let body = data.html || data.text || data.body || '';
        let subject = data.subject || '(fără subiect)';

        if (!body && data.email_id) {
          const resendApiKey = process.env.RESEND_API_KEY;
          if (resendApiKey) {
            const fullEmail = await fetchEmailContent(data.email_id, resendApiKey);
            if (fullEmail) {
              body = fullEmail.html || fullEmail.text || fullEmail.body || '';
              subject = fullEmail.subject || subject;
            }
          }
        }

        // Thread detection — find parent email via In-Reply-To / References
        const parentEmailId = await detectParentEmail(data.headers, supabase);

        // Generate email ID upfront (needed for PDF storage path)
        const emailId = crypto.randomUUID();

        // Fetch and save attachments from Resend API to Supabase Storage
        let savedAttachments: { name: string; type: string; size: number; path: string }[] = [];
        const resendApiKey = process.env.RESEND_API_KEY;
        if (data.email_id && resendApiKey && data.attachments?.length > 0) {
          savedAttachments = await saveAttachments(data.email_id, resendApiKey, userId, emailId, supabase);
        }

        const pdfFilePath = savedAttachments.find(a => a.type === 'application/pdf')?.path || null;

        const { error: insertError } = await supabase
          .from('emails')
          .insert({
            id: emailId,
            user_id: userId,
            parent_email_id: parentEmailId,
            message_id: data.message_id || data.email_id,
            type: 'received',
            from_email: rawFrom,
            to_email: toEmail,
            subject,
            body,
            attachments: savedAttachments.length > 0
              ? savedAttachments.map(a => ({ name: a.name, type: a.type, size: a.size, path: a.path }))
              : data.attachments?.map((a: { filename: string; content_type: string }) => ({
                  name: a.filename,
                  type: a.content_type,
                })) || [],
            pdf_file_path: pdfFilePath,
            processing_status: 'pending',
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

        console.log(
          `[Webhook] Email ${emailId} saved: parent=${parentEmailId || 'none'}, ` +
          `attachments=${savedAttachments.length}`,
        );

        // Trigger processing pipeline after the response is sent.
        // next/server after() keeps the function alive on Vercel until done.
        const processUrl = new URL('/api/emails/process', request.url).toString();
        const cronSecret = process.env.CRON_SECRET;
        after(async () => {
          try {
            const res = await fetch(processUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
              },
              body: JSON.stringify({ email_id: emailId }),
            });
            if (!res.ok) {
              const text = await res.text();
              console.error(`[Webhook] Process trigger failed for ${emailId}: ${res.status} ${text}`);
            }
          } catch (err) {
            console.error(`[Webhook] Process trigger error for ${emailId}:`, err);
          }
        });

        return NextResponse.json({
          received: true,
          matched: true,
          email_id: emailId,
          has_body: !!body,
          attachments: savedAttachments.length,
          has_parent: !!parentEmailId,
          processing: 'triggered',
        });
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
