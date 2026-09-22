/**
 * Emailul de confirmare trimis când un administrator aprobă un cont.
 *
 * Conținut pur: nicio dependență de transport, ca să poată fi verificat fără Resend. Trimiterea
 * propriu-zisă e în `users.ts`, cu același tipar ca digestul de termene (`notifications/digest.ts`).
 */
import { escapeHtml } from '@m544/notifications/template';

export interface ApprovalEmailContext {
  /** Prenumele utilizatorului; gol când profilul nu are niciun nume. */
  displayName: string;
  /** Baza aplicației, ex. https://implicarecivica.ro (ținta linkului e `${appUrl}/login`). */
  appUrl: string;
}

export interface ApprovalEmail {
  subject: string;
  html: string;
  text: string;
}

export const APPROVAL_SUBJECT = 'Contul tău Implicare Civică a fost aprobat';

export function buildApprovalEmail({ displayName, appUrl }: ApprovalEmailContext): ApprovalEmail {
  const nume = displayName.trim();
  const salut = nume ? `Salut, ${nume},` : 'Salut,';
  const login = `${appUrl.replace(/\/+$/, '')}/login`;

  const text = [
    salut,
    '',
    'Contul tău a fost aprobat. Poți intra în platformă și poți trimite cereri de informații',
    'publice în baza Legii 544/2001.',
    '',
    login,
    '',
    'Cu stimă,',
    'Echipa Implicare Civică',
  ].join('\n');

  const html = [
    `<p>${escapeHtml(salut)}</p>`,
    '<p>Contul tău a fost aprobat. Poți intra în platformă și poți trimite cereri de informații publice în baza Legii 544/2001.</p>',
    `<p><a href="${escapeHtml(login)}">Intră în cont</a></p>`,
    '<p>Cu stimă,<br>Echipa Implicare Civică</p>',
  ].join('\n');

  return { subject: APPROVAL_SUBJECT, html, text };
}
