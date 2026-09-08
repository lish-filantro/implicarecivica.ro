/**
 * Contract tests for GET /api/emails/attachments?path=<userId>/<emailId>/<file>
 * Signed URL (1h) for the caller's own files only.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createAttachmentUrlHandler, SIGNED_URL_TTL_SECONDS } from '@m544/emails/attachments';
import { FakeStorageRepo } from '../_fakes/fake-repos';
import { fakeSupabase } from './_fake-client';

const abc = { id: 'abc', email: 'a@b.ro' } as User;

function build(user: User | null = abc) {
  const storage = new FakeStorageRepo();
  const handler = createAttachmentUrlHandler(() => ({
    createClient: async () => fakeSupabase(user),
    storage: () => storage,
  }));
  return { handler, storage };
}

const get = (path?: string) =>
  new NextRequest(
    `http://localhost/api/emails/attachments${path === undefined ? '' : `?path=${encodeURIComponent(path)}`}`,
  );

describe('GET /api/emails/attachments', () => {
  it('401 when not logged in', async () => {
    expect((await build(null).handler(get('abc/e1/a.pdf'))).status).toBe(401);
  });

  it('400 when path is missing or empty', async () => {
    const { handler } = build();
    expect((await handler(get())).status).toBe(400);
    expect((await handler(get(''))).status).toBe(400);
  });

  it("403 for another user's prefix, including a prefix that merely starts with the user id", async () => {
    const { handler } = build();
    expect((await handler(get('zzz/e1/a.pdf'))).status).toBe(403);
    expect((await handler(get('abcd/e1/a.pdf'))).status).toBe(403);
    expect((await handler(get('abc'))).status).toBe(403);
  });

  it('404 when the object does not exist', async () => {
    const { handler } = build();
    const res = await handler(get('abc/e1/missing.pdf'));
    expect(res.status).toBe(404);
  });

  it("200 with a 1-hour signed url for the caller's own file", async () => {
    const { handler, storage } = build();
    await storage.upload('abc/e1/a.pdf', new Uint8Array([1]), 'application/pdf');
    const res = await handler(get('abc/e1/a.pdf'));
    expect(res.status).toBe(200);
    expect(SIGNED_URL_TTL_SECONDS).toBe(3600);
    expect(await res.json()).toEqual({ url: 'https://storage.test/abc/e1/a.pdf?exp=3600' });
  });
});
