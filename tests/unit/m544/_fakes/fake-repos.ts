/**
 * In-memory implementations of the manager-544 repository interfaces.
 * Used by unit tests instead of Supabase. Behaviour mirrors the real
 * implementations (same filtering/ordering rules) so the shared contract
 * tests in tests/unit/m544/shared/repos.test.ts run against both.
 */
import { randomUUID } from 'node:crypto';
import type { Email } from '@m544/shared/types/email';
import type { Request } from '@m544/shared/types/request';
import type { EmailsRepo, EmailInsert, EmailPatch } from '@m544/shared/db/emails-repo';
import type { RequestsRepo, RequestPatch } from '@m544/shared/db/requests-repo';
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import type { ProfilesRepo } from '@m544/shared/db/profiles-repo';

const nowIso = () => new Date().toISOString();

export class FakeEmailsRepo implements EmailsRepo {
  rows = new Map<string, Email>();

  seed(partial: Partial<Email> & { user_id: string }): Email {
    const id = partial.id ?? randomUUID();
    const row: Email = {
      id,
      message_id: partial.message_id ?? `<${id}@test>`,
      type: partial.type ?? 'received',
      from_email: partial.from_email ?? 'x@y.ro',
      to_email: partial.to_email ?? 'u@implicarecivica.ro',
      subject: partial.subject ?? 'subject',
      ocr_processed: false,
      processing_status: 'pending',
      retry_count: 0,
      is_read: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...partial,
    };
    this.rows.set(id, row);
    return row;
  }

  async getById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async insert(data: EmailInsert) {
    if ([...this.rows.values()].some((r) => r.user_id === data.user_id && r.message_id === data.message_id)) {
      return { ok: false as const, duplicate: true as const };
    }
    const withoutNulls = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== null),
    ) as unknown as Partial<Email> & { user_id: string };
    return { ok: true as const, email: this.seed(withoutNulls) };
  }

  async update(id: string, patch: EmailPatch) {
    const row = this.rows.get(id);
    if (!row) throw new Error(`email ${id} not found`);
    Object.assign(row, patch, { updated_at: nowIso() });
  }

  async findIdByMessageId(messageId: string) {
    return [...this.rows.values()].find((r) => r.message_id === messageId)?.id ?? null;
  }

  async getRequestIdOfEmail(emailId: string) {
    return this.rows.get(emailId)?.request_id ?? null;
  }

  async listPendingReceived(limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.type === 'received' && r.processing_status === 'pending' && r.retry_count < 3)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit)
      .map((r) => r.id);
  }

  async hasSentToAddress(requestId: string, address: string) {
    const needle = address.toLowerCase();
    return [...this.rows.values()].some(
      (r) => r.request_id === requestId && r.type === 'sent' && r.to_email.toLowerCase().includes(needle),
    );
  }

  async findSenderUserId(fromEmail: string) {
    return [...this.rows.values()].find((r) => r.type === 'sent' && r.from_email === fromEmail)?.user_id ?? null;
  }
}

export class FakeRequestsRepo implements RequestsRepo {
  rows = new Map<string, Request>();

  seed(partial: Partial<Request> & { user_id: string }): Request {
    const id = partial.id ?? randomUUID();
    const row: Request = {
      id,
      institution_name: partial.institution_name ?? 'Primăria Test',
      subject: partial.subject ?? 'Cerere informații publice - Legea 544/2001',
      status: 'pending',
      date_initiated: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      ...partial,
    };
    this.rows.set(id, row);
    return row;
  }

  async getById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, patch: RequestPatch) {
    const row = this.rows.get(id);
    if (!row) throw new Error(`request ${id} not found`);
    Object.assign(row, patch, { updated_at: nowIso() });
  }

  async findByRegistrationNumber(userId: string, reg: string) {
    return [...this.rows.values()].find((r) => r.user_id === userId && r.registration_number === reg)?.id ?? null;
  }

  async listWithRegistration(userId: string) {
    return [...this.rows.values()]
      .filter((r) => r.user_id === userId && !!r.registration_number)
      .map((r) => ({ id: r.id, registration_number: r.registration_number! }));
  }

  async listOpen(userId: string) {
    return [...this.rows.values()]
      .filter((r) => r.user_id === userId && r.status !== 'answered')
      .sort((a, b) => a.date_initiated.localeCompare(b.date_initiated))
      .map((r) => ({
        id: r.id,
        status: r.status,
        subject: r.subject,
        institution_name: r.institution_name,
        institution_email: r.institution_email ?? null,
        date_initiated: r.date_initiated,
        registration_number: r.registration_number ?? null,
      }));
  }

  async listOverdueIds(nowIso: string) {
    return [...this.rows.values()]
      .filter((r) => r.status !== 'answered' && r.status !== 'delayed')
      .filter((r) => {
        const eff = r.extension_date || r.deadline_date;
        return !!eff && eff < nowIso;
      })
      .map((r) => r.id);
  }
}

export class FakeStorageRepo implements StorageRepo {
  files = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async download(path: string) {
    return this.files.get(path)?.bytes ?? null;
  }

  async upload(path: string, bytes: Uint8Array, contentType: string) {
    this.files.set(path, { bytes, contentType });
  }

  async createSignedUrl(path: string, expiresInSeconds: number) {
    return this.files.has(path) ? `https://storage.test/${path}?exp=${expiresInSeconds}` : null;
  }
}

export class FakeProfilesRepo implements ProfilesRepo {
  rows = new Map<string, { id: string; mailcow_email: string | null; display_name: string | null; approved: boolean }>();

  seed(row: { id: string; mailcow_email?: string | null; display_name?: string | null; approved?: boolean }) {
    const full = { mailcow_email: null, display_name: null, approved: true, ...row };
    this.rows.set(row.id, full);
    return full;
  }

  async findIdByMailcowEmail(email: string) {
    return [...this.rows.values()].find((r) => r.mailcow_email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  }

  async getSenderIdentity(userId: string) {
    const r = this.rows.get(userId);
    return r ? { display_name: r.display_name, mailcow_email: r.mailcow_email } : null;
  }
}
