import { createHash } from "crypto";

/**
 * Creates a SHA-256 hash of an IP address for GDPR-compliant storage.
 * We don't store raw IPs — only hashes for deduplication.
 */
export function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function hashUserAgent(ua: string): string {
  return createHash("sha256").update(ua).digest("hex").slice(0, 16);
}
