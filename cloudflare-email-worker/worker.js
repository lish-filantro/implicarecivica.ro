/**
 * Cloudflare Email Worker — Inbound email receiver for implicarecivica.ro
 *
 * Receives emails via Cloudflare Email Routing,
 * extracts headers + raw MIME body, and forwards to the Next.js API.
 * Full parsing (body, attachments) happens server-side.
 *
 * Environment variables (set in Cloudflare dashboard → Worker Settings):
 *   WEBHOOK_URL    — https://implicarecivica.ro/api/webhooks/cloudflare-email
 *   WEBHOOK_SECRET — shared secret for authenticating requests
 *   BACKUP_EMAIL   — (optional) forward a copy to this address as backup
 */
export default {
  async email(message, env, ctx) {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get('subject') || '(fără subiect)';
    const messageId = message.headers.get('message-id') || '';
    const inReplyTo = message.headers.get('in-reply-to') || '';
    const references = message.headers.get('references') || '';

    console.log(`[Email Worker] Received: from=${from}, to=${to}, subject=${subject}`);

    try {
      // Read raw MIME email as base64 (preserves binary attachments)
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      const bytes = new Uint8Array(rawBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const rawBase64 = btoa(binary);

      const payload = {
        from,
        to,
        subject,
        message_id: messageId.replace(/[<>]/g, ''),
        in_reply_to: inReplyTo.replace(/[<>]/g, ''),
        references,
        raw_email_base64: rawBase64,
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
