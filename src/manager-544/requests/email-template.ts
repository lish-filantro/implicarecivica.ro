/**
 * The Law 544/2001 request email. One list of lines feeds both the plain-text
 * preview and the HTML body sent to institutions; the wording is fixed (question
 * extraction relies on the "Solicitare … :" / "Aștept" markers).
 */

export const FIXED_SUBJECT = 'Cerere informații publice - Legea 544/2001';

/** The wizard form fields the template needs (WizardFormData is a superset). */
export interface EmailTemplateData {
  solicitantName: string;
  solicitantAddress: string;
  solicitantEmail: string;
  institutionName: string;
}

export function emailBodyLines(question: string, data: EmailTemplateData): string[] {
  return [
    `Solicitant: ${data.solicitantName}`,
    `Adresa: ${data.solicitantAddress}`,
    `Email: ${data.solicitantEmail}`,
    '',
    `Stimate reprezentant al ${data.institutionName},`,
    '',
    `Subsemnatul ${data.solicitantName}, cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:`,
    '',
    question,
    '',
    `Aștept cu interes răspunsul dumneavoastră la adresa de email ${data.solicitantEmail} și vă mulțumesc anticipat pentru cooperare.`,
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
