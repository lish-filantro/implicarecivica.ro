/**
 * The Law 544/2001 request email. One list of lines feeds both the plain-text
 * preview and the HTML body sent to institutions; the wording is fixed (question
 * extraction relies on the "Solicitare … :" / "Aștept" markers).
 *
 * Reformulat pe 2026-09-22 după raportul de testare (F7). Orice schimbare aici se face în
 * acelaşi commit cu `utils/question-extraction.ts`: extragerea ancorează pe formulările de mai
 * jos, iar cererile deja trimise poartă formularea veche, deci tiparele vechi rămân acolo.
 */

export const FIXED_SUBJECT = 'Cerere informații publice - Legea 544/2001';

/** The wizard form fields the template needs (WizardFormData is a superset). */
export interface EmailTemplateData {
  solicitantName: string;
  solicitantAddress: string;
  solicitantEmail: string;
  institutionName: string;
  /** Pentru acordul lui „Subsemnatul/Subsemnata". Lipseşte la conturile de dinainte de 019. */
  solicitantGender?: 'f' | 'm' | null;
}

/**
 * Formula de deschidere e invariabilă. „Stimate reprezentant al {instituţie}" cerea acordul cu
 * numele instituţiei şi ieşea greşit pentru cele feminine („al Agenția") — raportul de testare
 * din 2026-09-22.
 */
const SALUT = 'Stimată doamnă/Stimate domn,';

function subsemnatul(gender: EmailTemplateData['solicitantGender']): string {
  if (gender === 'f') return 'Subsemnata';
  if (gender === 'm') return 'Subsemnatul';
  return 'Subsemnatul/Subsemnata';
}

export function emailBodyLines(question: string, data: EmailTemplateData): string[] {
  return [
    `Solicitant: ${data.solicitantName}`,
    `Adresa: ${data.solicitantAddress}`,
    `Email: ${data.solicitantEmail}`,
    '',
    SALUT,
    '',
    // „cu domiciliul în X" este formularea uzuală în cererile 544; „cu datele de contact
    // menţionate mai sus" nu apare în niciun model oficial.
    `${subsemnatul(data.solicitantGender)} ${data.solicitantName}, cu domiciliul în ${data.solicitantAddress}, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:`,
    '',
    question,
    '',
    `Aștept cu interes răspunsul dumneavoastră la adresa de email ${data.solicitantEmail}.`,
    '',
    'Vă mulțumesc anticipat pentru cooperare.',
    '',
    '',
    'Cu stimă,',
    data.solicitantName,
  ];
}

/** HTML body for one request email (empty lines become <br>). */
export function formatEmailBodyHtml(question: string, data: EmailTemplateData): string {
  return emailBodyLines(question, data)
    .map((line) => line || '<br>')
    .join('<br>\n');
}

/** Plain-text body (preview). */
export function formatEmailBodyText(question: string, data: EmailTemplateData): string {
  return emailBodyLines(question, data).join('\n');
}
