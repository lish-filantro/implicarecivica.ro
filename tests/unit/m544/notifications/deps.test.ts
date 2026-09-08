/** Unit tests for src/manager-544/notifications/deps.ts (production wiring from env). */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createNotificationDeps } from '@m544/notifications/deps';
import { SupabaseNotificationsRepo } from '@m544/notifications/repo';

const saved: Record<string, string | undefined> = {};
const KEYS = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_EMAIL_DOMAIN', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests';
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_EMAIL_DOMAIN;
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('createNotificationDeps', () => {
  it('defaults: implicarecivica.ro app URL and notificari@ sender', () => {
    const d = createNotificationDeps();
    expect(d.appUrl).toBe('https://implicarecivica.ro');
    expect(d.fromAddress).toBe('Implicare Civică <notificari@implicarecivica.ro>');
    expect(d.repo).toBeInstanceOf(SupabaseNotificationsRepo);
    expect(d.now).toBeUndefined();
  });

  it('reads NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_EMAIL_DOMAIN when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.example.ro';
    process.env.NEXT_PUBLIC_EMAIL_DOMAIN = 'mail.example.ro';
    const d = createNotificationDeps();
    expect(d.appUrl).toBe('https://staging.example.ro');
    expect(d.fromAddress).toBe('Implicare Civică <notificari@mail.example.ro>');
  });

  it('the sender is resolved lazily (building deps does not touch RESEND_API_KEY)', () => {
    const key = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const d = createNotificationDeps();
      expect(Object.getOwnPropertyDescriptor(d, 'sender')?.get).toBeTypeOf('function');
    } finally {
      if (key !== undefined) process.env.RESEND_API_KEY = key;
    }
  });
});
