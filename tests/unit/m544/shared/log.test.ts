/**
 * shared/log — structured events: one JSON line in production, readable text in dev.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createLogger, log } from '@m544/shared/log';

function fakeConsole() {
  const lines: Array<{ level: string; text: string }> = [];
  return {
    lines,
    console: {
      log: (text: string) => lines.push({ level: 'log', text }),
      warn: (text: string) => lines.push({ level: 'warn', text }),
      error: (text: string) => lines.push({ level: 'error', text }),
    },
  };
}

afterEach(() => {
  delete process.env.VERCEL_ENV;
});

describe('createLogger in production', () => {
  it('writes one JSON line with level, event, ts and the fields', () => {
    const { console, lines } = fakeConsole();
    const logger = createLogger({ console, production: true });
    logger.info('inbound.ingested', { email_id: 'e1', attachments: 2 });
    expect(lines).toHaveLength(1);
    expect(lines[0].level).toBe('log');
    const parsed = JSON.parse(lines[0].text);
    expect(parsed).toMatchObject({ level: 'info', event: 'inbound.ingested', email_id: 'e1', attachments: 2 });
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('routes warn/error to console.warn/console.error and serialises errors as { name, message }', () => {
    const { console, lines } = fakeConsole();
    const logger = createLogger({ console, production: true });
    logger.warn('inbound.no_user', { to: 'x@y.ro' });
    logger.error('inbound.reconcile_error', { key: 'inbound/a.eml', error: new TypeError('boom') });
    expect(lines.map((l) => l.level)).toEqual(['warn', 'error']);
    expect(JSON.parse(lines[1].text).error).toEqual({ name: 'TypeError', message: 'boom' });
  });

  it('reads isProduction() from the environment when `production` is not given', () => {
    const { console, lines } = fakeConsole();
    const logger = createLogger({ console });
    process.env.VERCEL_ENV = 'production';
    logger.info('x');
    expect(() => JSON.parse(lines[0].text)).not.toThrow();
  });
});

describe('createLogger in development', () => {
  it('writes "[level] event key=value" with JSON for non-string values', () => {
    const { console, lines } = fakeConsole();
    const logger = createLogger({ console, production: false });
    logger.info('inbound.duplicate', { message_id: 'm@x', count: 3, ok: true, error: new Error('nope') });
    expect(lines[0].text).toBe('[info] inbound.duplicate message_id=m@x count=3 ok=true error=Error: nope');
  });

  it('omits the fields part when there are none', () => {
    const { console, lines } = fakeConsole();
    createLogger({ console, production: false }).warn('inbound.reconciled');
    expect(lines[0]).toEqual({ level: 'warn', text: '[warn] inbound.reconciled' });
  });
});

describe('default instance', () => {
  it('exposes info/warn/error', () => {
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });
});
