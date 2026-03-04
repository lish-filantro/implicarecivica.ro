/**
 * Cloudflare Email Worker — Inbound email receiver for implicarecivica.ro
 *
 * This worker receives emails via Cloudflare Email Routing,
 * parses the raw MIME content, and forwards it to the Next.js API.
 *
 * Environment variables (set in Cloudflare dashboard):
 *   WEBHOOK_URL    — https://implicarecivica.ro/api/webhooks/cloudflare-email
 *   WEBHOOK_SECRET — shared secret for authenticating requests
 *   BACKUP_EMAIL   — (optional) forward a copy to this address as backup
 */
import PostalMime from 'postal-mime';

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
      // Read raw MIME email
      const rawEmail = await new Response(message.raw).arrayBuffer();

      // Parse with postal-mime
      const parser = new PostalMime();
      const parsed = await parser.parse(rawEmail);

      // Extract body (prefer HTML, fallback to text)
      const body = parsed.html || parsed.text || '';

      // Process attachments — convert to base64 for transport
      const attachments = [];
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          // Max 10MB per attachment for the webhook payload
          if (att.content && att.content.byteLength <= 10 * 1024 * 1024) {
            const bytes = new Uint8Array(att.content);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            attachments.push({
              filename: att.filename || 'attachment',
              content_type: att.mimeType || 'application/octet-stream',
              size: att.content.byteLength,
              content_base64: base64,
            });
          } else if (att.content) {
            // Too large — include metadata only
            attachments.push({
              filename: att.filename || 'attachment',
              content_type: att.mimeType || 'application/octet-stream',
              size: att.content.byteLength,
              content_base64: null,
            });
            console.warn(`[Email Worker] Attachment ${att.filename} too large (${att.content.byteLength} bytes), skipping content`);
          }
        }
      }

      // Send to Next.js API
      const payload = {
        from,
        to,
        subject,
        message_id: messageId.replace(/[<>]/g, ''),
        in_reply_to: inReplyTo.replace(/[<>]/g, ''),
        references,
        body,
        attachments,
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
        // Reject so Cloudflare retries
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
