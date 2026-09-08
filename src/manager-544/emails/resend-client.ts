/**
 * Resend SDK client (outgoing mail). Built lazily from RESEND_API_KEY through
 * shared/env, so a missing or placeholder key is an explicit EnvError at first
 * use instead of a silent misconfiguration.
 */
import { Resend } from 'resend';
import { requireSecret } from '@m544/shared/env';

let cached: Resend | null = null;

export function getResend(): Resend {
  if (!cached) cached = new Resend(requireSecret('RESEND_API_KEY'));
  return cached;
}
