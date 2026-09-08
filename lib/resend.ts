// getResend lives in @m544/emails/resend-client; re-exported here for lib/campanii (out of the refactor scope).
// EMAIL_DOMAIN stays here: it is only used by lib/campanii (out of the refactor scope).
export { getResend } from '@m544/emails/resend-client';

export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'implicarecivica.ro';
