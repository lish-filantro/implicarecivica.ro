/**
 * GET /api/emails/attachments?path=<userId>/<emailId>/<filename>
 *
 * Returns a 1-hour signed URL for one of the caller's own attachments.
 * The path must start with `<userId>/` — slash-delimited, so user "abc" can
 * never read "abcd/...". The signed URL is created through the SESSION client,
 * so storage RLS applies as a second line of defence.
 */
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, withErrorBoundary } from '@m544/shared/http';
import { createServerClient } from '@m544/shared/db/clients';
import { SupabaseStorageRepo, type StorageRepo } from '@m544/shared/db/storage-repo';

export const SIGNED_URL_TTL_SECONDS = 3600;

export interface AttachmentDeps<C extends AuthClient = SupabaseClient> {
  createClient: () => Promise<C>;
  storage: (sb: C) => StorageRepo;
}

export function createAttachmentUrlHandler<C extends AuthClient>(getDeps: () => AttachmentDeps<C>) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser({ createClient: deps.createClient });
    if (!guard.ok) return guard.response;

    const path = request.nextUrl.searchParams.get('path');
    if (!path) return httpError(400, 'Lipsă parametru path');
    if (!path.startsWith(`${guard.user.id}/`)) return httpError(403, 'Acces interzis');

    const url = await deps.storage(guard.supabase).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (!url) return httpError(404, 'Fișierul nu a fost găsit');

    return json({ url });
  }, 'emails/attachments');
}

export function createAttachmentDeps(): AttachmentDeps {
  return {
    createClient: createServerClient,
    storage: (sb) => new SupabaseStorageRepo(sb),
  };
}
