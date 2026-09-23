/**
 * One email of the send queue: the POST to /api/emails/send and how its failure is classified.
 * Pure of the store's state, so both the first run and the retry use it unchanged.
 */
import { buildEmailRequest } from './send-requests';
import type { QuestionItem, WizardFormData } from '../wizard/types';

export interface SendFailure {
  question: string;
  error: string;
  /**
   * Doar când Resend a respins emailul: ştim sigur că n-a plecat şi o nouă încercare poate
   * reuşi. Un refuz al rutei (fişier lipsă, limita zilnică) ar pica la fel a doua oară, iar un
   * timeout sau o conexiune ruptă pot veni după trimitere — o retrimitere ar dubla cererea la
   * instituţie, deci acolo omul verifică în dashboard.
   */
  retryable: boolean;
  /** The draft request the email belongs to; the retry reuses it (no new request row). */
  requestId: string;
}

export function postJson(fetchFn: typeof fetch, url: string, body: unknown): Promise<Response> {
  return fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/**
 * Un corp care nu e JSON (ex. pagina HTML a unui 504) vine de la platformă, nu de la ruta noastră:
 * funcţia poate să fi fost oprită DUPĂ ce emailul a plecat, deci omul trebuie să verifice înainte
 * să retrimită. Erorile JSON sunt ale rutei şi îşi păstrează mesajul.
 */
async function readError(response: Response): Promise<{ error: string; retryable: boolean }> {
  try {
    const data: { error?: string } = await response.json();
    const error = data.error || `Eroare ${response.status}`;
    // 500 „Eroare la trimitere:” = Resend a respins emailul (send.ts). Vezi SendFailure.retryable.
    const retryable = response.status === 500 && error.startsWith('Eroare la trimitere:');
    return { error, retryable };
  } catch {
    const why = response.status === 504 ? 'serverul nu a răspuns la timp' : 'răspuns neașteptat de la server';
    return { error: `Eroare ${response.status} — ${why}; verifică în dashboard dacă cererea a plecat.`, retryable: false };
  }
}

const CONNECTION_LOST = 'Conexiunea s-a întrerupt; verifică în dashboard dacă cererea a plecat.';

/**
 * One email of the queue. A rejected fetch (network drop) is a failure of THIS email, not of
 * the queue: it used to abort the loop, leaving the rest unsent, and the banner then suggested
 * reopening the preview — which creates the requests a second time.
 */
export async function sendOne(
  fetchFn: typeof fetch,
  question: QuestionItem,
  formData: WizardFormData,
  requestId: string,
  label: string,
): Promise<SendFailure | null> {
  let response: Response;
  try {
    response = await postJson(fetchFn, '/api/emails/send', buildEmailRequest(question, formData, requestId));
  } catch (err) {
    console.error('Email send request failed:', err);
    return { question: question.text, error: CONNECTION_LOST, retryable: false, requestId };
  }
  if (response.ok) return null;
  // Nu doar în consolă: omul trebuie să afle ce cerere n-a plecat şi de ce.
  const { error, retryable } = await readError(response);
  console.error(`Failed to send email ${label}:`, error);
  return { question: question.text, error, retryable, requestId };
}
