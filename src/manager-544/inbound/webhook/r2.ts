/**
 * Cloudflare R2 (S3-compatible) access for the raw emails the Email Worker
 * parks in the `email-staging` bucket before calling our webhook.
 */
import { AwsClient } from 'aws4fetch';
import { requireEnv, requireSecret } from '@m544/shared/env';

export const R2_BUCKET = 'email-staging';

/** Structural subset of aws4fetch's AwsClient (signed fetch). */
export interface R2Client {
  fetch(url: string, init?: { method?: string }): Promise<Response>;
}

export interface R2Deps {
  client?: R2Client;
  accountId?: string;
}

export function r2BucketUrl(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com/${R2_BUCKET}`;
}

export function r2ObjectUrl(accountId: string, key: string): string {
  return `${r2BucketUrl(accountId)}/${key}`;
}

/** Resolve client + account from deps or env. Throws EnvError when credentials are missing. */
export function resolveR2(deps: R2Deps): { client: R2Client; accountId: string } {
  const accountId = deps.accountId ?? requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const client =
    deps.client ??
    new AwsClient({
      accessKeyId: requireSecret('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireSecret('R2_SECRET_ACCESS_KEY'),
      service: 's3',
      region: 'auto',
    });
  return { client, accountId };
}

export async function fetchRawEmail(key: string, deps: R2Deps = {}): Promise<Uint8Array> {
  const { client, accountId } = resolveR2(deps);
  const response = await client.fetch(r2ObjectUrl(accountId, key));
  if (!response.ok) {
    throw new Error(`R2 fetch failed: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Best-effort cleanup after the email is persisted; never throws. */
export async function deleteRawEmail(key: string, deps: R2Deps = {}): Promise<void> {
  try {
    const { client, accountId } = resolveR2(deps);
    await client.fetch(r2ObjectUrl(accountId, key), { method: 'DELETE' });
  } catch (err) {
    console.warn(`[R2] Failed to delete ${key}:`, err instanceof Error ? err.message : err);
  }
}
