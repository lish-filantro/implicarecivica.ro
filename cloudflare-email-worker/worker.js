/**
 * Cloudflare Email Worker — Inbound email receiver for implicarecivica.ro
 *
 * Receives emails via Cloudflare Email Routing and forwards to Next.js API.
 * Uses chunked base64 encoding for CPU efficiency.
 *
 * Environment variables:
 *   WEBHOOK_URL    — https://implicarecivica.ro/api/webhooks/cloudflare-email
 *   WEBHOOK_SECRET — shared secret for authenticating requests
 *   BACKUP_EMAIL   — (optional) forward a copy to this address
 */

const MAX_RAW_SIZE = 3 * 1024 * 1024; // 3MB — safe under Vercel's 4.5MB limit after base64
const CHUNK_SIZE = 8192; // Process 8KB at a time for base64 encoding

/**
 * Efficiently convert ArrayBuffer to base64 using chunked processing.
 * Avoids CPU timeout by not building a huge string character by character.
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    let binary = '';
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
    chunks.push(binary);
  }
  return btoa(chunks.join(''));
}

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
      // Common header fields
      const headers = {
        from,
        to,
        subject,
        message_id: messageId.replace(/[<>]/g, ''),
        in_reply_to: inReplyTo.replace(/[<>]/g, ''),
        references,
        received_at: new Date().toISOString(),
      };

      let payload;

      // Check size BEFORE reading raw (use rawSize if available)
      const estimatedSize = rawSize || MAX_RAW_SIZE + 1;

      if (estimatedSize <= MAX_RAW_SIZE) {
        // Small email — send full raw MIME for server-side parsing
        const rawBuffer = await new Response(message.raw).arrayBuffer();

        if (rawBuffer.byteLength <= MAX_RAW_SIZE) {
          payload = {
            ...headers,
            raw_email_base64: arrayBufferToBase64(rawBuffer),
          };
        } else {
          // rawSize was wrong, actually large
          payload = {
            ...headers,
            body: '',
            large_email: true,
          };
        }
      } else {
        // Large email — don't even try to base64 the full thing
        // Read raw just to extract text body
        const rawBuffer = await new Response(message.raw).arrayBuffer();
        const rawText = new TextDecoder().decode(rawBuffer.slice(0, 100000)); // First 100KB for body extraction

        let body = '';
        // Try to extract HTML body
        const htmlMatch = rawText.match(
          /Content-Type:\s*text\/html[^\r\n]*[\r\n]+(?:Content-Transfer-Encoding:\s*(\S+)[\r\n]+)?[\r\n]+([\s\S]*?)(?:[\r\n]--)/i
        );
        const textMatch = rawText.match(
          /Content-Type:\s*text\/plain[^\r\n]*[\r\n]+(?:Content-Transfer-Encoding:\s*(\S+)[\r\n]+)?[\r\n]+([\s\S]*?)(?:[\r\n]--)/i
        );

        const match = htmlMatch || textMatch;
        if (match) {
          const encoding = (match[1] || '7bit').toLowerCase();
          const content = match[2].trim();
          if (encoding === 'base64') {
            try { body = atob(content.replace(/\s/g, '')); } catch { body = content; }
          } else if (encoding === 'quoted-printable') {
            body = content
              .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
              .replace(/=\r?\n/g, '');
          } else {
            body = content;
          }
        }

        payload = {
          ...headers,
          body,
          large_email: true,
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
