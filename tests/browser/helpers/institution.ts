/**
 * The "institution clerk" side of the browser suite: reads the institution
 * account's inbox (the citizen's requests arrive there through the real inbound
 * path) and answers through Resend with proper In-Reply-To/References headers,
 * from the institution's platform address.
 */
import { INSTITUTION, INSTITUTION_NAME } from './accounts';
import { listEmails, waitFor, type EmailRow } from './db';
import { requireTestEnv } from './env';

/** Waits until `count` request emails have reached the institution inbox since `since`. */
export function waitForRequestsInInbox(count: number, since: string): Promise<EmailRow[]> {
  return waitFor(
    async () => {
      const rows = await listEmails(INSTITUTION.id, 'received', since);
      return rows.length >= count ? rows : null;
    },
    { label: `${count} request email(s) in the institution inbox`, timeoutMs: 240_000 },
  );
}

export interface ReplyInput {
  /** The request email as stored in the institution inbox. */
  original: EmailRow;
  html: string;
  /**
   * true  → a reply on the request's thread ("Re: <subject>", In-Reply-To/References),
   *         the way registries confirm the registration number;
   * false → a brand-new email (own subject, no threading headers), the way most
   *         institutions send the actual answer later: it can only be matched
   *         through the registration number in its text.
   */
  inThread: boolean;
  subject?: string;
}

/** Sends the institution's email via Resend; returns the Resend id. */
export async function replyAsInstitution({ original, html, inThread, subject }: ReplyInput): Promise<string> {
  const messageId = `<${original.message_id}>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requireTestEnv('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${INSTITUTION_NAME} <${INSTITUTION.platformEmail}>`,
      to: [original.from_email],
      subject: subject ?? (inThread ? `Re: ${original.subject}` : original.subject),
      html,
      ...(inThread ? { headers: { 'In-Reply-To': messageId, References: messageId } } : {}),
    }),
  });
  const body = (await res.json()) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`Resend reply failed: ${res.status} ${body.message ?? ''}`);
  return body.id;
}

export function confirmationHtml(registrationNumber: string): string {
  return `<p>Bună ziua,</p>
<p>Vă confirmăm că cererea dumneavoastră formulată în baza Legii 544/2001 a fost înregistrată la
${INSTITUTION_NAME} cu numărul <b>${registrationNumber}</b>.</p>
<p>Răspunsul va fi comunicat în termenul legal.</p>
<p>Cu stimă,<br/>Registratura ${INSTITUTION_NAME}</p>`;
}

export function finalAnswerHtml(registrationNumber: string): string {
  return `<p>Bună ziua,</p>
<p>Urmare a cererii dumneavoastră înregistrată cu nr. <b>${registrationNumber}</b>, vă comunicăm următoarele:</p>
<ul>
<li>În anul 2025 au fost încheiate 3 contracte de reparații stradale, în valoare totală de 1.250.000 lei.</li>
<li>Lucrările au fost recepționate în decembrie 2025.</li>
<li>Garanția lucrărilor este de 24 de luni.</li>
</ul>
<p>Cu stimă,<br/>Registratura ${INSTITUTION_NAME}</p>`;
}
