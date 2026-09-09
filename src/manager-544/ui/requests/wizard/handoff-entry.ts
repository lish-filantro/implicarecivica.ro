/**
 * Entering the wizard from a conversation (/requests/new?conversation=<id>):
 * the form seed built from the hand-off, the proposed session name and the
 * decision whether step 1 can be skipped.
 */
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { isValidInstitutionEmail } from './types';
import type { ChatData, WizardFormData, WizardProfile } from './types';

export const SESSION_NAME_MAX_CE = 40;
export const DEFAULT_SESSION_NAME = 'Cerere Legea 544';

/** First `max` characters of `text`, cut on a word boundary, trailing punctuation dropped. */
function headOnWordBoundary(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  if (/\s/.test(clean.charAt(max))) return clean.slice(0, max).trimEnd();
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max / 3 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '');
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** "Groapă mare în asfalt pe strada Mioriței, Primăria Sector 3" — the CE cut at 40 chars + the institution. */
export function sessionNameFrom(ce: string, institutionName: string): string {
  const problem = capitalize(headOnWordBoundary(ce ?? '', SESSION_NAME_MAX_CE));
  const institution = (institutionName ?? '').trim();
  if (problem && institution) return `${problem}, ${institution}`;
  return problem || institution || DEFAULT_SESSION_NAME;
}

/** The chat data the wizard form is seeded with. */
export function formFromHandoff(handoff: ConversationHandoff, conversationId: string | null): ChatData {
  return {
    institutionName: handoff.institutionName,
    institutionEmail: handoff.institutionEmail,
    conversationId,
    sessionName: sessionNameFrom(handoff.problemContext?.ce ?? '', handoff.institutionName),
  };
}

/**
 * Step 2 straight away when the profile has a name and an address and the
 * hand-off carries a valid institution email; otherwise step 1 with the gaps marked.
 */
export function decideStartStep(handoff: ConversationHandoff | null, profile: WizardProfile | null): 1 | 2 {
  if (!handoff || !profile) return 1;
  const hasName = Boolean(profile.display_name?.trim());
  const hasAddress = Boolean(profile.address?.trim());
  const hasEmail = isValidInstitutionEmail(handoff.institutionEmail ?? '');
  return hasName && hasAddress && hasEmail && Boolean(handoff.institutionName.trim()) ? 2 : 1;
}

const REQUIRED_FIELDS: Array<keyof WizardFormData> = [
  'solicitantName',
  'solicitantEmail',
  'solicitantAddress',
  'sessionName',
  'institutionName',
  'institutionEmail',
];

/** Required fields still empty (or an invalid institution email), for highlighting on step 1. */
export function missingFormFields(formData: WizardFormData): Array<keyof WizardFormData> {
  return REQUIRED_FIELDS.filter((field) => {
    const value = String(formData[field] ?? '').trim();
    if (!value) return true;
    return field === 'institutionEmail' && !isValidInstitutionEmail(value);
  });
}
