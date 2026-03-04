import { NextRequest, NextResponse, after } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import PostalMime from 'postal-mime';
import { AwsClient } from 'aws4fetch';

/**
 * Extract raw email address from RFC 5322 format.
 * "Ion Popescu <ion.popescu@domain.ro>" → "ion.popescu@domain.ro"
 */
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

/**
 * Detect parent email via In-Reply-To / References headers.
 * Returns the parent email's UUID from our DB, or null.
 */
async function detectParentEmail(
  inReplyTo: string | undefined,
  references: string | undefined,
  supabase: ReturnType<typeof createServerClient>,
): Promise<string | null> {
  const messageIdsToCheck: string[] = [];

  if (inReplyTo) {
    const cleaned = inReplyTo.replace(/[<>]/g, '').trim();
    if (cleaned) messageIdsToCheck.push(cleaned);
  }

  if (references) {
    const refs = references.split(/\s+/).map((r) => r.replace(/[<>]/g, '').trim()).filter(Boolean);
    for (const ref of refs) {
      if (!messageIdsToCheck.includes(ref)) {
        messageIdsToCheck.push(ref);
      }
    }
  }

  if (messageIdsToCheck.length === 0) return null;

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
 * Save parsed attachments to Supabase Storage.
 */
async function saveAttachments(
  attachments: { filename: string; mimeType: string; content: Uint8Array }[],
  userId: string,
  emailId: string,
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ name: string; type: string; size: number; path: string }[]> {
  const saved: { name: string; type: string; size: number; path: string }[] = [];

  for (const att of attachments) {
    try {
      const buffer = Buffer.from(att.content);

      // Max 50MB
      if (buffer.length > 50 * 1024 * 1024) {
        console.warn(`[Attachments] ${att.filename} too large (${buffer.length} bytes), skipping`);
        continue;
      }

      const filename = att.filename || 'attachment';
      const storagePath = `${userId}/${emailId}/${filename}`;

      const { error } = await supabase.storage
        .from('email-attachments')
        .upload(storagePath, buffer, {
          contentType: att.mimeType || 'application/octet-stream',
          upsert: true,
        });

      if (error) {
        console.error(`[Attachments] Upload failed for ${filename}:`, error.message);
        continue;
      }

      console.log(`[Attachments] Saved ${filename} (${buffer.length} bytes)`);
      saved.push({
        name: filename,
        type: att.mimeType || 'application/octet-stream',
        size: buffer.length,
        path: storagePath,
      });
    } catch (err: any) {
      console.error(`[Attachments] Error processing ${att.filename}:`, err.message);
    }
  }

  return saved;
}

/**
 * Fetch raw email from Cloudflare R2 bucket via S3-compatible API.
 */
async function fetchFromR2(r2Key: string): Promise<ArrayBuffer> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = 'email-staging';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  // Use Cloudflare R2 S3-compatible API
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${r2Key}`;

  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  const response = await r2.fetch(url);

  if (!response.ok) {
    throw new Error(`R2 fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Delete raw email from R2 after processing.
 */
async function deleteFromR2(r2Key: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = 'email-staging';

  if (!accountId || !accessKeyId || !secretAccessKey) return;

  try {
    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });

    const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${r2Key}`;
    await r2.fetch(url, { method: 'DELETE' });
    console.log(`[R2] Deleted ${r2Key}`);
  } catch (err: any) {
    console.warn(`[R2] Failed to delete ${r2Key}:`, err.message);
  }
}

/**
 * Cloudflare Email Worker Webhook Handler
 *
 * Receives metadata from the Cloudflare Email Worker,
 * fetches raw MIME from R2, parses it, saves to Supabase,
 * and triggers the processing pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify shared secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;

    if (expectedSecret && expectedSecret !== 'placeholder') {
      if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = await request.json();
    const { from, to, subject, message_id, in_reply_to, references, r2_key, raw_size, received_at } = payload;

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from/to' }, { status: 400 });
    }

    if (!r2_key) {
      return NextResponse.json({ error: 'Missing r2_key' }, { status: 400 });
    }

    console.log(`[CF Email] Received: from=${from}, to=${to}, subject=${subject}, r2=${r2_key}, size=${raw_size}`);

    // Fetch raw email from R2
    const rawBuffer = await fetchFromR2(r2_key);
    console.log(`[CF Email] Fetched ${rawBuffer.byteLength} bytes from R2`);

    // Parse raw MIME email
    const parser = new PostalMime();
    const parsed = await parser.parse(rawBuffer);
    const body = parsed.html || parsed.text || '';
    const parsedAttachments = (parsed.attachments || []).map((att) => ({
      filename: att.filename || 'attachment',
      mimeType: att.mimeType || 'application/octet-stream',
      content: new Uint8Array(att.content as ArrayBuffer),
    }));

    // Use service role to bypass RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );

    const toEmail = extractEmail(to);

    // Find user by mailcow_email
    const { data: matchedProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('mailcow_email', toEmail)
      .limit(1);

    let userId = matchedProfile?.[0]?.id;

    // Fallback: check if this address was used to send
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
      console.warn('[CF Email] No user found for:', toEmail);
      return NextResponse.json({ received: true, matched: false });
    }

    // Thread detection
    const parentEmailId = await detectParentEmail(in_reply_to, references, supabase);

    // Generate email ID
    const emailId = crypto.randomUUID();

    // Save attachments to Supabase Storage
    let savedAttachments: { name: string; type: string; size: number; path: string }[] = [];
    if (parsedAttachments.length > 0) {
      savedAttachments = await saveAttachments(parsedAttachments, userId, emailId, supabase);
    }

    const pdfFilePath = savedAttachments.find((a) => a.type === 'application/pdf' && a.path)?.path || null;

    // Save email to database
    const { error: insertError } = await supabase
      .from('emails')
      .insert({
        id: emailId,
        user_id: userId,
        parent_email_id: parentEmailId,
        message_id: message_id || emailId,
        type: 'received',
        from_email: from,
        to_email: toEmail,
        subject: subject || '(fără subiect)',
        body,
        attachments: savedAttachments.map((a) => ({ name: a.name, type: a.type, size: a.size, path: a.path })),
        pdf_file_path: pdfFilePath,
        processing_status: 'pending',
        is_read: false,
        received_at: received_at || new Date().toISOString(),
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error('[CF Email] DB insert error:', insertError);
      return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
    }

    console.log(
      `[CF Email] Saved email ${emailId}: parent=${parentEmailId || 'none'}, attachments=${savedAttachments.length}`,
    );

    // Clean up R2 and trigger processing pipeline after response
    const processUrl = new URL('/api/emails/process', request.url).toString();
    const cronSecret = process.env.CRON_SECRET;
    after(async () => {
      // Delete raw email from R2 (already saved to Supabase)
      await deleteFromR2(r2_key);

      // Trigger processing pipeline
      try {
        const res = await fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cronSecret && cronSecret !== 'placeholder' ? { Authorization: `Bearer ${cronSecret}` } : {}),
          },
          body: JSON.stringify({ email_id: emailId }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`[CF Email] Process trigger failed for ${emailId}: ${res.status} ${text}`);
        }
      } catch (err) {
        console.error(`[CF Email] Process trigger error for ${emailId}:`, err);
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
  } catch (error) {
    console.error('[CF Email] Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
