// Compatibility re-export — getResend moved to @m544/emails/resend-client (removed in refactor phase 6).
// EMAIL_DOMAIN stays here: it is only used by lib/campanii (out of the refactor scope).
export { getResend } from '@m544/emails/resend-client';

export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'implicarecivica.ro';
