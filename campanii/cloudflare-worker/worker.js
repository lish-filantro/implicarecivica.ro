/**
 * Cloudflare Email Worker for BCC Tracking
 *
 * This worker receives emails at track@campanii.implicarecivica.ro
 * and notifies the campaign platform to confirm participations.
 *
 * Setup:
 * 1. Create a Cloudflare Worker with this code
 * 2. Set up Email Routing for campanii.implicarecivica.ro
 * 3. Route track@campanii.implicarecivica.ro to this worker
 * 4. Add environment variable: WEBHOOK_SECRET (same as CLOUDFLARE_WEBHOOK_SECRET in .env)
 * 5. Add environment variable: API_URL = https://campanii.implicarecivica.ro
 */

export default {
  async email(message, env) {
    const subject = message.headers.get("subject") || "";
    const from = message.from || "";

    // Clean subject (remove Re:, Fwd: prefixes)
    const cleanSubject = subject.replace(/^(Re|Fwd|FW|RE):\s*/gi, "").trim();

    if (!cleanSubject) {
      console.log("Empty subject, skipping");
      return;
    }

    try {
      const apiUrl = env.API_URL || "https://campanii.implicarecivica.ro";

      const response = await fetch(`${apiUrl}/api/track-inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": env.WEBHOOK_SECRET || "",
        },
        body: JSON.stringify({
          subject: cleanSubject,
          from: from,
        }),
      });

      if (!response.ok) {
        console.error(`API responded with ${response.status}:`, await response.text());
      } else {
        console.log(`Confirmed participation for subject: "${cleanSubject}" from: ${from}`);
      }
    } catch (error) {
      console.error("Failed to notify API:", error);
    }
  },
};
