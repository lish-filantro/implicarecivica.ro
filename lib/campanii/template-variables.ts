import type { FormFieldsConfig } from "./types/campaign";

export interface TemplateVariable {
  key: string;
  tag: string;
  label: string;
  description: string;
  category: "participant" | "campaign" | "meta";
  sampleValue: string;
  /** Maps to a FormFieldsConfig key, or null if no form field needed */
  formField: keyof FormFieldsConfig | null;
  alwaysRequired: boolean;
  icon: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Participant fields — generate form fields
  {
    key: "nume_participant",
    tag: "{nume_participant}",
    label: "Nume participant",
    description: "Numele complet al persoanei",
    category: "participant",
    sampleValue: "Ion Popescu",
    formField: null, // always present, not in form_fields
    alwaysRequired: true,
    icon: "User",
  },
  {
    key: "oras_participant",
    tag: "{oras_participant}",
    label: "Oraș",
    description: "Orașul sau sectorul participantului",
    category: "participant",
    sampleValue: "București, Sector 3",
    formField: "city",
    alwaysRequired: false,
    icon: "MapPin",
  },
  {
    key: "profesie_participant",
    tag: "{profesie_participant}",
    label: "Profesie",
    description: "Profesia sau ocupația",
    category: "participant",
    sampleValue: "inginer",
    formField: "profession",
    alwaysRequired: false,
    icon: "Briefcase",
  },
  {
    key: "organizatie_participant",
    tag: "{organizatie_participant}",
    label: "Organizație participant",
    description: "Instituția sau firma participantului",
    category: "participant",
    sampleValue: "ONG Civitas",
    formField: "participant_organization",
    alwaysRequired: false,
    icon: "Building2",
  },
  {
    key: "telefon_participant",
    tag: "{telefon_participant}",
    label: "Telefon",
    description: "Număr de telefon",
    category: "participant",
    sampleValue: "0721 123 456",
    formField: "phone",
    alwaysRequired: false,
    icon: "Phone",
  },
  {
    key: "cod_postal_participant",
    tag: "{cod_postal_participant}",
    label: "Cod poștal",
    description: "Codul poștal",
    category: "participant",
    sampleValue: "010101",
    formField: "postal_code",
    alwaysRequired: false,
    icon: "Hash",
  },
  {
    key: "sector_participant",
    tag: "{sector_participant}",
    label: "Sector",
    description: "Sectorul (București)",
    category: "participant",
    sampleValue: "Sector 3",
    formField: "sector",
    alwaysRequired: false,
    icon: "Map",
  },
  // Campaign / meta fields — no form field needed
  {
    key: "data",
    tag: "{data}",
    label: "Data curentă",
    description: "Data la momentul trimiterii",
    category: "meta",
    sampleValue: "2 martie 2026",
    formField: null,
    alwaysRequired: false,
    icon: "Calendar",
  },
  {
    key: "organizatie",
    tag: "{organizatie}",
    label: "Organizație campanie",
    description: "Organizația inițiatoare a campaniei",
    category: "campaign",
    sampleValue: "Asociația Civică XYZ",
    formField: null,
    alwaysRequired: false,
    icon: "Flag",
  },
];

/** Detect which template variables are used in a text */
export function detectUsedVariables(text: string): string[] {
  if (!text) return [];
  const regex = /\{(\w+)\}/g;
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (TEMPLATE_VARIABLES.some((v) => v.key === match![1])) {
      found.add(match[1]);
    }
  }
  return Array.from(found);
}

/** Derive FormFieldsConfig from variables used in email template */
export function deriveFormFields(usedVariables: string[]): FormFieldsConfig {
  const fields: FormFieldsConfig = {
    city: false,
    postal_code: false,
    custom_field: null,
    profession: false,
    participant_organization: false,
    phone: false,
    sector: false,
  };

  for (const key of usedVariables) {
    const variable = TEMPLATE_VARIABLES.find((v) => v.key === key);
    if (variable?.formField && variable.formField in fields) {
      (fields[variable.formField] as boolean) = true;
    }
  }

  return fields;
}

/** Render template with sample data for live preview */
export function renderWithSampleData(template: string): string {
  if (!template) return "";
  let result = template;
  for (const v of TEMPLATE_VARIABLES) {
    result = result.replace(new RegExp(`\\{${v.key}\\}`, "g"), v.sampleValue);
  }
  return result;
}

/** Get variables grouped by category */
export function getVariablesByCategory() {
  const groups: Record<string, TemplateVariable[]> = {
    participant: [],
    campaign: [],
    meta: [],
  };
  for (const v of TEMPLATE_VARIABLES) {
    groups[v.category].push(v);
  }
  return groups;
}
