/**
 * Structured event logging for the server side of manager-544.
 *
 *   log.info('inbound.ingested', { email_id, attachments })
 *
 * In production (Vercel) every call is one JSON line — ready for a log drain:
 *   {"level":"info","event":"inbound.ingested","ts":"...","email_id":"..."}
 * Elsewhere it is a readable line: `[info] inbound.ingested email_id=...`.
 * Error values in `fields` are serialised as `{ name, message }`.
 */
import { isProduction } from '@m544/shared/env';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export type ConsoleLike = Pick<Console, 'log' | 'warn' | 'error'>;

export interface LoggerOptions {
  console?: ConsoleLike;
  /** Forces the format; when omitted `isProduction()` is evaluated on every call. */
  production?: boolean;
  now?: () => Date;
}

const METHOD: Record<LogLevel, keyof ConsoleLike> = { info: 'log', warn: 'warn', error: 'error' };

function normalise(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  return value;
}

function formatDevValue(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  return JSON.stringify(value);
}

export function createLogger({ console: out = globalThis.console, production, now = () => new Date() }: LoggerOptions = {}): Logger {
  const emit = (level: LogLevel, event: string, fields: LogFields = {}) => {
    const isProd = production ?? isProduction();
    let line: string;
    if (isProd) {
      const body: Record<string, unknown> = { level, event, ts: now().toISOString() };
      for (const [k, v] of Object.entries(fields)) body[k] = normalise(v);
      line = JSON.stringify(body);
    } else {
      const parts = Object.entries(fields).map(([k, v]) => `${k}=${formatDevValue(v)}`);
      line = parts.length ? `[${level}] ${event} ${parts.join(' ')}` : `[${level}] ${event}`;
    }
    out[METHOD[level]](line);
  };
  return {
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
}

/** Default logger used by production code; tests inject their own via `deps`. */
export const log: Logger = createLogger();
