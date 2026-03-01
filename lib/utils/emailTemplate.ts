import type { WizardFormData } from '@/lib/hooks/useRequestWizard';

const FIXED_SUBJECT = 'Cerere informații publice - Legea 544/2001';

/**
 * Generates the HTML body for a single 544 request email.
 * Template matches the existing format from useEmailFields.getEmailBody().
 */
export function formatEmailBodyHtml(question: string, formData: WizardFormData): string {
  const lines = [
    `Solicitant: ${formData.solicitantName}`,
    `Adresa: ${formData.solicitantAddress}`,
    `Email: ${formData.solicitantEmail}`,
    '',
    `Stimate reprezentant al ${formData.institutionName},`,
    '',
    `Subsemnatul ${formData.solicitantName}, cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:`,
    '',
    question,
    '',
    `Aștept cu interes răspunsul dumneavoastră la adresa de email ${formData.solicitantEmail} și vă mulțumesc anticipat pentru cooperare.`,
    '',
    '',
    'Cu stimă,',
    formData.solicitantName,
  ];

  return lines.map(line => line || '<br>').join('<br>\n');
}

/**
 * Returns plain-text version of the email body (for preview).
 */
export function formatEmailBodyText(question: string, formData: WizardFormData): string {
  return [
    `Solicitant: ${formData.solicitantName}`,
    `Adresa: ${formData.solicitantAddress}`,
    `Email: ${formData.solicitantEmail}`,
    '',
    `Stimate reprezentant al ${formData.institutionName},`,
    '',
    `Subsemnatul ${formData.solicitantName}, cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:`,
    '',
    question,
    '',
    `Aștept cu interes răspunsul dumneavoastră la adresa de email ${formData.solicitantEmail} și vă mulțumesc anticipat pentru cooperare.`,
    '',
    '',
    'Cu stimă,',
    formData.solicitantName,
  ].join('\n');
}

export { FIXED_SUBJECT };
