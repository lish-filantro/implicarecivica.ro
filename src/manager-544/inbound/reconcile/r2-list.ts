/**
 * Read-only R2 helpers for the reconcile cron: list the `inbound/` objects the
 * worker parked (S3 ListObjectsV2, paginated) and read one object's
 * customMetadata (HEAD → `x-amz-meta-*`). The XML is tiny and regular, so a
 * regex parser is enough — no new dependency.
 */
import { resolveR2, r2BucketUrl, r2ObjectUrl, type R2Deps } from '../webhook/r2';

export const INBOUND_PREFIX = 'inbound/';

export interface R2ObjectInfo {
  key: string;
  size: number;
  /** ISO timestamp from R2 (when the worker wrote the object). */
  lastModified: string;
}

export interface ListPage {
  objects: R2ObjectInfo[];
  nextToken: string | null;
}

const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

function unescapeXml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m);
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? unescapeXml(match[1].trim()) : null;
}

/** Parse one ListObjectsV2 response. Entries without a key are ignored. */
export function parseListResponse(xml: string): ListPage {
  const objects: R2ObjectInfo[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = tag(match[1], 'Key');
    if (!key) continue;
    objects.push({
      key,
      size: Number(tag(match[1], 'Size') ?? 0) || 0,
      lastModified: tag(match[1], 'LastModified') ?? '',
    });
  }
  const truncated = tag(xml, 'IsTruncated') === 'true';
  const nextToken = truncated ? tag(xml, 'NextContinuationToken') : null;
  return { objects, nextToken: nextToken || null };
}

export interface ListDeps extends R2Deps {
  prefix?: string;
  /** Safety cap on pages (1000 keys each). */
  maxPages?: number;
}

export async function listInboundObjects(deps: ListDeps = {}): Promise<R2ObjectInfo[]> {
  const { client, accountId } = resolveR2(deps);
  const prefix = deps.prefix ?? INBOUND_PREFIX;
  const maxPages = deps.maxPages ?? 10;
  const all: R2ObjectInfo[] = [];
  let token: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ 'list-type': '2', prefix });
    if (token) params.set('continuation-token', token);
    const response = await client.fetch(`${r2BucketUrl(accountId)}?${params.toString()}`);
    if (!response.ok) throw new Error(`R2 list failed: ${response.status} ${response.statusText}`);
    const parsed = parseListResponse(await response.text());
    all.push(...parsed.objects);
    token = parsed.nextToken;
    if (!token) break;
  }
  return all;
}

const META_PREFIX = 'x-amz-meta-';

/** Reverse of the worker's `encodeMetaValue`; a value that is not valid percent-encoding is kept as-is. */
export function decodeMetaValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** customMetadata of one object as `{ from, to, subject, ... }` (keys without the x-amz-meta- prefix). */
export async function headObjectMetadata(key: string, deps: R2Deps = {}): Promise<Record<string, string>> {
  const { client, accountId } = resolveR2(deps);
  const response = await client.fetch(r2ObjectUrl(accountId, key), { method: 'HEAD' });
  if (!response.ok) throw new Error(`R2 head failed for ${key}: ${response.status} ${response.statusText}`);
  const metadata: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(META_PREFIX)) metadata[lower.slice(META_PREFIX.length)] = decodeMetaValue(value);
  });
  return metadata;
}
