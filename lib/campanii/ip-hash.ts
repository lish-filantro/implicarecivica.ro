import { createHash } from "crypto";

export function hashIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function hashUserAgent(ua: string): string {
  return createHash("sha256").update(ua).digest("hex").slice(0, 16);
}
