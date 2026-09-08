/**
 * Prompt material for the strategic-questions generator: the five question
 * categories, the system prompt and the per-category user prompt.
 */

export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

export interface CategoryConfig {
  label: string;
  description: string;
}

export const CATEGORY_CONFIG = {
  A_FINANCIAR: {
    label: 'A. Financiar',
    description: 'Buget, cheltuieli, contracte, achiziții publice, fonduri alocate',
  },
  B_RESPONSABILITATE: {
    label: 'B. Responsabilitate',
    description: 'Cine răspunde, proceduri interne, termene, persoane responsabile',
  },
  C_PLANIFICARE: {
    label: 'C. Planificare',
    description: 'Planuri de acțiune, buget viitor, calendar lucrări, proiecte aprobate',
  },
  D_MONITORIZARE: {
    label: 'D. Monitorizare',
    description: 'Sesizări similare primite, rezolvări anterioare, indicatori de performanță',
  },
  E_CONFORMITATE: {
    label: 'E. Conformitate',
    description: 'Norme și reglementări aplicabile, audituri, sancțiuni, inspecții',
  },
} as const satisfies Record<string, CategoryConfig>;

export type QuestionCategory = keyof typeof CATEGORY_CONFIG;

export const VALID_CATEGORIES = Object.keys(CATEGORY_CONFIG) as QuestionCategory[];

export function isQuestionCategory(value: unknown): value is QuestionCategory {
  return typeof value === 'string' && Object.hasOwn(CATEGORY_CONFIG, value);
}

export const SYSTEM_PROMPT =
  'Ești un expert juridic specializat în Legea 544/2001 privind liberul acces la informațiile de interes public din România. ' +
  'Generezi întrebări strategice pe care cetățenii le pot adresa instituțiilor publice. ' +
  'Răspunzi exclusiv în limba română.';

export function buildUserPrompt(
  ce: string,
  unde: string,
  cand: string,
  institutie: string,
  category: QuestionCategory,
): string {
  const config = CATEGORY_CONFIG[category];
  return `Generează exact 10 întrebări strategice pentru categoria ${config.label} (${config.description}).

Context problemă:
- CE: ${ce}
- UNDE: ${unde}
- DE CÂND: ${cand || 'nespecificat'}
- INSTITUȚIE: ${institutie || 'nespecificată'}

Reguli:
1. Întrebările trebuie să fie concrete, legate de contextul specific al problemei descrise
2. Fiecare întrebare trebuie să ceară documente, date numerice sau fapte verificabile
3. NU folosi ton acuzator sau abstract
4. Fiecare întrebare trebuie formulată ca o solicitare formală conform Legii 544/2001
5. Întrebările trebuie să acopere aspecte diferite ale categoriei ${config.label}
6. Formulează întrebările la persoana I ("Vă rog să îmi furnizați...", "Solicit informații despre...")

Răspunde DOAR cu cele 10 întrebări, câte una pe linie, numerotate 1-10. Fără introducere, fără explicații suplimentare.`;
}
