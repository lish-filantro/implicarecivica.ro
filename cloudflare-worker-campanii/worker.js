/**
 * DEPRECATED — Campaign BCC tracking is now handled by the main
 * cloudflare-email-worker via /api/webhooks/cloudflare-email.
 *
 * Each campaign has its own email address (campaign_email column)
 * and the main worker routes emails to campaigns based on the
 * destination address.
 *
 * This worker can be safely removed from Cloudflare once all
 * email routing rules point to the main worker.
 */

export default {
  async email(message, env) {
    // Forward to main worker's endpoint for backwards compatibility
    const subject = message.headers.get("subject") || "";
    const from = message.from || "";

    const cleanSubject = subject.replace(/^(Re|Fwd|FW|RE):\s*/gi, "").trim();
    if (!cleanSubject) return;

    try {
      const apiUrl = env.API_URL || "https://campanii.implicarecivica.ro";
      await fetch(`${apiUrl}/api/campanii/track-inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": env.WEBHOOK_SECRET || "",
        },
        body: JSON.stringify({ subject: cleanSubject, from }),
      });
    } catch (error) {
      console.error("Failed to notify API:", error);
    }
  },
};
