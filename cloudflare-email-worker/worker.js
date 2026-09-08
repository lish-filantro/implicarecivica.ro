/**
 * Cloudflare Email Worker — Inbound email receiver for implicarecivica.ro
 *
 * Flow:
 * 1. Receives the email via Cloudflare Email Routing
 * 2. Saves the raw MIME to R2 (any size) with the full envelope as customMetadata
 *    (from, to, subject, message_id, in_reply_to, references, received_at, raw_size)
 * 3. POSTs the same envelope + r2_key to the Next.js webhook
 * 4. The webhook fetches the raw email from R2, parses it, stores it and
 *    deletes the R2 object once the email is safely in the database
 *
 * Delivery guarantees:
 *   - The email is ACCEPTED as soon as the R2 put succeeds. A failing webhook
 *     (5xx, timeout, deploy in progress) is only logged: the raw object stays in
 *     R2 and GET /api/cron/reconcile-inbound (every 6 h) rebuilds the payload
 *     from the customMetadata and ingests it. Nothing bounces because of us.
 *   - `setReject('Storage error')` is used ONLY when R2 itself fails — then the
 *     sending institution gets a bounce and can resend.
 *
 * Bindings:
 *   EMAIL_BUCKET   — R2 bucket binding (email-staging)
 *
 * Environment variables:
 *   WEBHOOK_URL    — https://implicarecivica.ro/api/webhooks/cloudflare-email
 *   WEBHOOK_SECRET — shared secret (CLOUDFLARE_EMAIL_WEBHOOK_SECRET on Vercel)
 *   BACKUP_EMAIL   — (optional) forward a copy to this address
 *
 * Deploy: `npx wrangler deploy` in this folder (bundles lib.js).
 */
import { buildMetadata, buildPayload, toCustomMetadata, newR2Key } from './lib.js';

async function notifyWebhook(env, payload) {
  try {
    const response = await fetch(env.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.WEBHOOK_SECRET}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[Email Worker] Webhook ${response.status} for ${payload.r2_key}; left in R2 for reconcile: ${text}`);
      return;
    }
    console.log(`[Email Worker] Delivered ${payload.r2_key}:`, await response.text());
  } catch (err) {
    console.error(`[Email Worker] Webhook unreachable for ${payload.r2_key}; left in R2 for reconcile:`, err?.message || err);
  }
}

export default {
  async email(message, env) {
    const receivedAt = new Date().toISOString();
    console.log(`[Email Worker] Received: from=${message.from}, to=${message.to}, size=${message.rawSize || 0}`);

    let metadata;
    let r2Key;
    try {
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      metadata = buildMetadata({
        from: message.from,
        to: message.to,
        headers: message.headers,
        rawSize: rawBuffer.byteLength,
        receivedAt,
      });
      r2Key = newR2Key();
      await env.EMAIL_BUCKET.put(r2Key, rawBuffer, { customMetadata: toCustomMetadata(metadata) });
      console.log(`[Email Worker] Saved to R2: ${r2Key} (${rawBuffer.byteLength} bytes)`);
    } catch (err) {
      // Nothing durable was written: bounce so the sender retries.
      console.error('[Email Worker] R2 put failed:', err?.message || err);
      message.setReject('Storage error');
      return;
    }

    // From here on the email is accepted no matter what happens below.
    await notifyWebhook(env, buildPayload(metadata, r2Key));

    if (env.BACKUP_EMAIL) {
      try {
        await message.forward(env.BACKUP_EMAIL);
      } catch (err) {
        console.error('[Email Worker] Backup forward failed:', err?.message || err);
      }
    }
  },
};
