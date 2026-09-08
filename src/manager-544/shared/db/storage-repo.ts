/**
 * Storage repository — the `email-attachments` bucket.
 * Paths are `<userId>/<emailId>/<filename>`; RLS on storage.objects scopes
 * browser reads to the first path segment.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const ATTACHMENTS_BUCKET = 'email-attachments';

export interface StorageRepo {
  /** File bytes, or null when the object does not exist. */
  download(path: string): Promise<Uint8Array | null>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Time-limited URL for the browser, or null when the object does not exist. */
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string | null>;
}

export class SupabaseStorageRepo implements StorageRepo {
  constructor(
    private readonly sb: SupabaseClient,
    private readonly bucket: string = ATTACHMENTS_BUCKET,
  ) {}

  async download(path: string): Promise<Uint8Array | null> {
    const { data, error } = await this.sb.storage.from(this.bucket).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async upload(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.sb.storage.from(this.bucket).upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;
  }

  async createSignedUrl(path: string, expiresInSeconds: number): Promise<string | null> {
    const { data, error } = await this.sb.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }
}
