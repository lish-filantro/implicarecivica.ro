/**
 * Shared types of the request wizard (steps 1-3 of /requests/new and /requests/add).
 * Moved 1:1 from lib/hooks/useRequestWizard.ts.
 */

import type { QuestionCategory } from '@m544/shared/types/questions';

export type { QuestionCategory };

export interface CategoryMeta {
  id: QuestionCategory;
  label: string;
  description: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'A_FINANCIAR', label: 'A. Financiar', description: 'Buget, cheltuieli, contracte' },
  { id: 'B_RESPONSABILITATE', label: 'B. Responsabilitate', description: 'Cine răspunde, proceduri, termene' },
  { id: 'C_PLANIFICARE', label: 'C. Planificare', description: 'Planuri, buget viitor, calendar' },
  { id: 'D_MONITORIZARE', label: 'D. Monitorizare', description: 'Sesizări similare, rezolvări, indicatori' },
  { id: 'E_CONFORMITATE', label: 'E. Conformitate', description: 'Norme, audit, sancțiuni' },
];

export const CATEGORY_IDS: QuestionCategory[] = CATEGORIES.map((c) => c.id);

/** Build a per-category record from one initial value (fresh copy per key). */
export function perCategory<T>(make: () => T): Record<QuestionCategory, T> {
  return {
    A_FINANCIAR: make(),
    B_RESPONSABILITATE: make(),
    C_PLANIFICARE: make(),
    D_MONITORIZARE: make(),
    E_CONFORMITATE: make(),
  };
}

export interface QuestionItem {
  id: string;
  category: QuestionCategory;
  text: string;
  isCustom: boolean;
  isEdited: boolean;
}

export interface WizardFormData {
  solicitantName: string;
  solicitantEmail: string;
  solicitantAddress: string;
  saveAddress: boolean;
  institutionName: string;
  institutionEmail: string;
  sessionName: string;
}

/** Institution / conversation data handed over by the chat page. */
export interface ChatData {
  institutionName?: string | null;
  institutionEmail?: string | null;
  conversationId?: string | null;
  /** Proposed session name (built from the problem and the institution). */
  sessionName?: string | null;
}

/** The subset of the profile the wizard pre-fills from. */
export interface WizardProfile {
  display_name?: string | null;
  mailcow_email?: string | null;
  address?: string | null;
}

export type WizardStep = 1 | 2 | 3;

/** Soft limit shown to the user: more requests at once are allowed, but discouraged. */
export const RECOMMENDED_MAX_SELECTED = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The (deliberately loose) email check used by step 1 validation and the field's red border. */
export function isValidInstitutionEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
