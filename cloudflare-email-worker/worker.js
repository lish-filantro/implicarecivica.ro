/**
 * Cloudflare Email Worker — Inbound email receiver for implicarecivica.ro
 *
 * Receives emails via Cloudflare Email Routing,
 * extracts headers + raw MIME body, and forwards to the Next.js API.
 *
 * For small emails (< 3MB): sends full raw MIME as base64
 * For large emails: sends headers + body text only, attachments as metadata
 *
 * Environment variables (set in Cloudflare dashboard → Worker Settings):
 *   WEBHOOK_URL    — https://implicarecivica.ro/api/webhooks/cloudflare-email
 *   WEBHOOK_SECRET — shared secret for authenticating requests
 *   BACKUP_EMAIL   — (optional) forward a copy to this address as backup
 */

const MAX_RAW_SIZE = 3 * 1024 * 1024; // 3MB — safe under Vercel's 4.5MB limit after base64

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
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      let payload;

      if (rawBuffer.byteLength <= MAX_RAW_SIZE) {
        // Small email — send full raw MIME for server-side parsing
        const bytes = new Uint8Array(rawBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const rawBase64 = btoa(binary);

        payload = {
          from,
          to,
          subject,
          message_id: messageId.replace(/[<>]/g, ''),
          in_reply_to: inReplyTo.replace(/[<>]/g, ''),
          references,
          raw_email_base64: rawBase64,
          received_at: new Date().toISOString(),
        };
      } else {
        // Large email — extract text body, send attachment metadata only
        console.log(`[Email Worker] Large email (${rawBuffer.byteLength} bytes), parsing in Worker`);

        const rawText = new TextDecoder().decode(rawBuffer);

        // Extract plain text body from MIME (best-effort)
        let body = '';
        const textMatch = rawText.match(
          /Content-Type:\s*text\/(?:html|plain)[^\r\n]*\r?\nContent-Transfer-Encoding:\s*(\S+)\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\r?\n)/i
        );
        if (textMatch) {
          const encoding = textMatch[1].toLowerCase();
          const content = textMatch[2].trim();
          if (encoding === 'base64') {
            try { body = atob(content.replace(/\s/g, '')); } catch { body = content; }
          } else if (encoding === 'quoted-printable') {
            body = content.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/=\r?\n/g, '');
          } else {
            body = content;
          }
        }

        // Extract attachment metadata (filename + content-type + size estimate)
        const attachments = [];
        const attRegex = /Content-Disposition:\s*attachment[^\r\n]*filename="?([^"\r\n;]+)"?/gi;
        const typeRegex = /Content-Type:\s*([^\s;]+)/gi;
        let match;
        while ((match = attRegex.exec(rawText)) !== null) {
          attachments.push({
            filename: match[1].trim(),
            content_type: 'application/octet-stream',
            size: 0,
            content_base64: null,
          });
        }

        payload = {
          from,
          to,
          subject,
          message_id: messageId.replace(/[<>]/g, ''),
          in_reply_to: inReplyTo.replace(/[<>]/g, ''),
          references,
          body,
          attachments_metadata: attachments,
          large_email: true,
          received_at: new Date().toISOString(),
        };
      }

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
