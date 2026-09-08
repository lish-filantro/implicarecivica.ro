/**
 * Service-role access to Supabase for the browser suite: account provisioning,
 * cleanup, and "wait until the pipeline did X" polling.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireTestEnv } from './env';
import type { TestAccount } from './accounts';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) client = createClient(requireTestEnv('NEXT_PUBLIC_SUPABASE_URL'), requireTestEnv('SUPABASE_SERVICE_ROLE_KEY'));
  return client;
}

/** Creates (or updates) the auth user + approved profile and sets the password. */
export async function ensureAccount(account: TestAccount, password: string): Promise<void> {
  const sb = db();
  const { data: existing } = await sb.auth.admin.getUserById(account.id);
  if (existing?.user) {
    const { error } = await sb.auth.admin.updateUserById(account.id, { password, email_confirm: true });
    if (error) throw new Error(`updateUserById(${account.loginEmail}): ${error.message}`);
  } else {
    const { error } = await sb.auth.admin.createUser({
      id: account.id,
      email: account.loginEmail,
      email_confirm: true,
      password,
    });
    if (error) throw new Error(`createUser(${account.loginEmail}): ${error.message}`);
  }
  const { error: profileError } = await sb.from('profiles').upsert({
    id: account.id,
    display_name: account.displayName,
    mailcow_email: account.platformEmail,
    approved: true,
    notification_email: false,
  });
  if (profileError) throw new Error(`profiles upsert(${account.loginEmail}): ${profileError.message}`);
}

/** Deletes every request/session/email (and stored attachments) of the account. */
export async function cleanupAccountData(account: TestAccount): Promise<void> {
  const sb = db();
  await sb.from('emails').delete().eq('user_id', account.id);
  await sb.from('requests').delete().eq('user_id', account.id);
  await sb.from('request_sessions').delete().eq('user_id', account.id);
  await sb.from('deadline_notifications').delete().eq('user_id', account.id);
  const { data: files } = await sb.storage.from('email-attachments').list(account.id, { limit: 100 });
  const folders = (files ?? []).map((f) => f.name);
  for (const folder of folders) {
    const { data: inner } = await sb.storage.from('email-attachments').list(`${account.id}/${folder}`, { limit: 100 });
    const paths = (inner ?? []).map((f) => `${account.id}/${folder}/${f.name}`);
    if (paths.length) await sb.storage.from('email-attachments').remove(paths);
  }
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  label?: string;
}

/** Polls `probe` until it returns a non-null value. */
export async function waitFor<T>(probe: () => Promise<T | null | undefined>, opts: WaitOptions = {}): Promise<T> {
  const timeout = opts.timeoutMs ?? 180_000;
  const interval = opts.intervalMs ?? 5_000;
  const started = Date.now();
  for (;;) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    if (Date.now() - started > timeout) throw new Error(`Timed out after ${timeout / 1000}s waiting for ${opts.label ?? 'condition'}`);
    await new Promise((r) => setTimeout(r, interval));
  }
}

export interface EmailRow {
  id: string;
  user_id: string;
  type: 'sent' | 'received';
  message_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string | null;
  category: string | null;
  registration_number: string | null;
  processing_status: string;
  needs_review: boolean | null;
  request_id: string | null;
  created_at: string;
}

export async function listEmails(userId: string, type: 'sent' | 'received', since: string): Promise<EmailRow[]> {
  const { data, error } = await db()
    .from('emails')
    .select('id, user_id, type, message_id, from_email, to_email, subject, body, category, registration_number, processing_status, needs_review, request_id, created_at')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EmailRow[];
}

export interface RequestRow {
  id: string;
  session_id: string | null;
  status: string;
  institution_name: string;
  institution_email: string | null;
  registration_number: string | null;
  deadline_date: string | null;
  response_received_date: string | null;
  subject: string;
  request_body: string | null;
}

export async function listRequests(userId: string): Promise<RequestRow[]> {
  const { data, error } = await db()
    .from('requests')
    .select('id, session_id, status, institution_name, institution_email, registration_number, deadline_date, response_received_date, subject, request_body')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RequestRow[];
}

export async function getEmail(id: string): Promise<EmailRow | null> {
  const { data } = await db().from('emails').select('*').eq('id', id).maybeSingle();
  return (data as EmailRow | null) ?? null;
}
