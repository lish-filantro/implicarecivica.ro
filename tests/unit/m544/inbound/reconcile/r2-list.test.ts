/**
 * inbound/reconcile/r2-list — ListObjectsV2 pagination + HEAD metadata on a fake signed client.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  parseListResponse,
  listInboundObjects,
  headObjectMetadata,
  decodeMetaValue,
  INBOUND_PREFIX,
} from '@m544/inbound/reconcile/r2-list';
import { r2BucketUrl, r2ObjectUrl } from '@m544/inbound/webhook/r2';
import { EnvError } from '@m544/shared/env';

const page = (contents: string, next?: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>email-staging</Name><Prefix>inbound/</Prefix><KeyCount>2</KeyCount><MaxKeys>1000</MaxKeys>
  <IsTruncated>${next ? 'true' : 'false'}</IsTruncated>
  ${next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ''}
  ${contents}
</ListBucketResult>`;

const contents = (key: string, size: number, modified: string) =>
  `<Contents><Key>${key}</Key><LastModified>${modified}</LastModified><ETag>"e"</ETag><Size>${size}</Size><StorageClass>STANDARD</StorageClass></Contents>`;

const calls: Array<{ url: string; method: string }> = [];
afterEach(() => {
  calls.length = 0;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
});

describe('parseListResponse', () => {
  it('extracts key, size and lastModified; unescapes XML entities; reads the continuation token', () => {
    const xml = page(
      contents('inbound/1-a.eml', 1228, '2026-09-08T10:00:00.000Z') + contents('inbound/2-b&amp;c.eml', 5, '2026-09-08T11:00:00.000Z'),
      'tok&amp;1',
    );
    expect(parseListResponse(xml)).toEqual({
      objects: [
        { key: 'inbound/1-a.eml', size: 1228, lastModified: '2026-09-08T10:00:00.000Z' },
        { key: 'inbound/2-b&c.eml', size: 5, lastModified: '2026-09-08T11:00:00.000Z' },
      ],
      nextToken: 'tok&1',
    });
  });

  it('empty bucket → no objects, no token', () => {
    expect(parseListResponse(page(''))).toEqual({ objects: [], nextToken: null });
  });
});

describe('listInboundObjects', () => {
  it('follows continuation tokens and concatenates the pages', async () => {
    const pages = [page(contents('inbound/1.eml', 1, 't1'), 'T2'), page(contents('inbound/2.eml', 2, 't2'))];
    const client = {
      fetch: async (url: string, init?: { method?: string }) => {
        calls.push({ url, method: init?.method ?? 'GET' });
        return new Response(pages.shift(), { status: 200 });
      },
    };
    const objects = await listInboundObjects({ client, accountId: 'acct' });
    expect(objects.map((o) => o.key)).toEqual(['inbound/1.eml', 'inbound/2.eml']);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${r2BucketUrl('acct')}?list-type=2&prefix=${encodeURIComponent(INBOUND_PREFIX)}`);
    expect(calls[1].url).toContain('continuation-token=T2');
  });

  it('throws on a non-2xx list response', async () => {
    const client = { fetch: async () => new Response(null, { status: 403, statusText: 'Forbidden' }) };
    await expect(listInboundObjects({ client, accountId: 'acct' })).rejects.toThrow(/403/);
  });

  it('without credentials throws EnvError (no network)', async () => {
    await expect(listInboundObjects()).rejects.toThrow(EnvError);
  });
});

describe('headObjectMetadata', () => {
  it('HEADs the object and returns the decoded x-amz-meta-* headers', async () => {
    const client = {
      fetch: async (url: string, init?: { method?: string }) => {
        calls.push({ url, method: init?.method ?? 'GET' });
        return new Response(null, {
          status: 200,
          headers: {
            'content-length': '1228',
            'x-amz-meta-from': 'Registratura <registratura@primaria.ro>',
            'x-amz-meta-subject': 'Re: Cerere informa%C8%9Bii',
            'x-amz-meta-raw_size': '1228',
          },
        });
      },
    };
    const meta = await headObjectMetadata('inbound/1.eml', { client, accountId: 'acct' });
    expect(calls[0]).toEqual({ url: r2ObjectUrl('acct', 'inbound/1.eml'), method: 'HEAD' });
    expect(meta).toEqual({
      from: 'Registratura <registratura@primaria.ro>',
      subject: 'Re: Cerere informații',
      raw_size: '1228',
    });
  });

  it('throws when the object is gone', async () => {
    const client = { fetch: async () => new Response(null, { status: 404, statusText: 'Not Found' }) };
    await expect(headObjectMetadata('inbound/x.eml', { client, accountId: 'acct' })).rejects.toThrow(/404/);
  });
});

describe('decodeMetaValue', () => {
  it('decodes percent-encoding and tolerates malformed input', () => {
    expect(decodeMetaValue('100%25')).toBe('100%');
    expect(decodeMetaValue('50% off')).toBe('50% off');
  });
});
