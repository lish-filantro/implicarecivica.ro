/**
 * Cloudflare Email Worker — Inbound email receiver for implicarecivica.ro
 *
 * Flow:
 * 1. Receives email via Cloudflare Email Routing
 * 2. Saves raw MIME to R2 bucket (handles any size)
 * 3. Sends metadata + R2 key to Next.js API
 * 4. API fetches raw email from R2, parses, saves attachments to Supabase
 *
 * Bindings:
 *   EMAIL_BUCKET   — R2 bucket binding (email-staging)
 *
 * Environment variables:
 *   WEBHOOK_URL    — https://implicarecivica.ro/api/webhooks/cloudflare-email
 *   WEBHOOK_SECRET — shared secret for authenticating requests
 *   BACKUP_EMAIL   — (optional) forward a copy to this address
 */

export default {
  async email(message, env, ctx) {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get('subject') || '(fără subiect)';
    const messageId = message.headers.get('message-id') || '';
    const inReplyTo = message.headers.get('in-reply-to') || '';
    const references = message.headers.get('references') || '';
    const rawSize = message.rawSize || 0;

    console.log(`[Email Worker] Received: from=${from}, to=${to}, subject=${subject}, size=${rawSize}`);

    try {
      // Read raw MIME email
      const rawBuffer = await new Response(message.raw).arrayBuffer();

      // Generate unique key for R2
      const timestamp = Date.now();
      const r2Key = `inbound/${timestamp}-${crypto.randomUUID()}.eml`;

      // Save to R2 bucket
      await env.EMAIL_BUCKET.put(r2Key, rawBuffer, {
        customMetadata: {
          from,
          to,
          subject,
          receivedAt: new Date().toISOString(),
        },
      });

      console.log(`[Email Worker] Saved to R2: ${r2Key} (${rawBuffer.byteLength} bytes)`);

      // Send metadata to API (no size limit issues — raw email is in R2)
      const payload = {
        from,
        to,
        subject,
        message_id: messageId.replace(/[<>]/g, ''),
        in_reply_to: inReplyTo.replace(/[<>]/g, ''),
        references,
        r2_key: r2Key,
        raw_size: rawBuffer.byteLength,
        received_at: new Date().toISOString(),
      };

      const response = await fetch(env.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.WEBHOOK_SECRET}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[Email Worker] API error: ${response.status} ${text}`);
        // Don't delete from R2 on failure — API can retry later
        message.setReject(`API error: ${response.status}`);
        return;
      }

      const result = await response.json();
      console.log(`[Email Worker] Delivered to API:`, JSON.stringify(result));

      // Optional: forward a backup copy
      if (env.BACKUP_EMAIL) {
        await message.forward(env.BACKUP_EMAIL);
      }
    } catch (err) {
      console.error(`[Email Worker] Error:`, err.message || err);
      message.setReject(`Worker error: ${err.message}`);
    }
  },
};
