/**
 * inbound/webhook/r2 — fetching/deleting the raw email the worker parked in R2.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRawEmail, deleteRawEmail, r2ObjectUrl, R2_BUCKET } from '@m544/inbound/webhook/r2';
import { EnvError } from '@m544/shared/env';

const calls: Array<{ url: string; method: string }> = [];
function fakeClient(status = 200, body = 'raw-eml') {
  return {
    fetch: async (url: string, init?: { method?: string }) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return new Response(status === 200 ? body : null, { status, statusText: status === 200 ? 'OK' : 'Error' });
    },
  };
}

afterEach(() => {
  calls.length = 0;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
});

describe('r2ObjectUrl', () => {
  it('builds the S3-compatible URL for the staging bucket', () => {
    expect(r2ObjectUrl('acct123', 'inbound/a.eml')).toBe(`https://acct123.r2.cloudflarestorage.com/${R2_BUCKET}/inbound/a.eml`);
  });
});

describe('fetchRawEmail', () => {
  it('GETs the object and returns its bytes', async () => {
    const bytes = await fetchRawEmail('inbound/a.eml', { client: fakeClient(), accountId: 'acct' });
    expect(Buffer.from(bytes).toString()).toBe('raw-eml');
    expect(calls[0]).toEqual({ url: r2ObjectUrl('acct', 'inbound/a.eml'), method: 'GET' });
  });

  it('throws with the status when the object is missing', async () => {
    await expect(fetchRawEmail('inbound/missing.eml', { client: fakeClient(404), accountId: 'acct' })).rejects.toThrow(/404/);
  });

  it('with no injected client, throws EnvError when R2 credentials are missing (no network)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(fetchRawEmail('inbound/a.eml')).rejects.toThrow(EnvError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('deleteRawEmail', () => {
  it('sends DELETE and resolves', async () => {
    await deleteRawEmail('inbound/a.eml', { client: fakeClient(204), accountId: 'acct' });
    expect(calls[0].method).toBe('DELETE');
  });

  it('never throws: failures are logged as warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      deleteRawEmail('inbound/a.eml', {
        client: { fetch: async () => { throw new Error('network down'); } },
        accountId: 'acct',
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('with missing credentials, logs and returns without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(deleteRawEmail('inbound/a.eml')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
