/**
 * Enrichment of rag_search results with the verified Legea 544 address learned
 * from answers we actually received (`institutii_locale`). When a result's
 * instantiated name is known, the model gets `email_verificat` + `verificat_la` as a
 * HINT: the prompt still requires the address to be found and confirmed on the
 * official website (user rule, 2026-09-09) — the database never replaces the web check.
 *
 * Best-effort: a failing lookup leaves the result as it was.
 */
import type { KnownInstitution } from '@m544/shared/db/institutions-repo';
import type { RagInstitutionResult } from './institutii-rag';

export type KnownInstitutionLookup = (name: string) => Promise<KnownInstitution[]>;

export type EnrichedRagResult = RagInstitutionResult & { email_verificat?: string; verificat_la?: string };

/** Templates whose name still carries a placeholder ("Primăria {localitate}") cannot be looked up. */
function isInstantiated(name: string): boolean {
  return name.length > 0 && !name.includes('{');
}

function verifiedNote(known: KnownInstitution): string {
  const date = known.verificat_la.slice(0, 10);
  return (
    `Adresa din email_verificat a apărut în ${known.nr_confirmari} răspuns(uri) primite de la această instituție ` +
    `(ultima dată la ${date}). Este doar un indiciu: confirmă adresa pe site-ul oficial cu web_search/web_fetch înainte să o prezinți.`
  );
}

async function enrichOne(result: RagInstitutionResult, lookup: KnownInstitutionLookup): Promise<EnrichedRagResult> {
  if (!isInstantiated(result.nume)) return result;
  try {
    const [best] = await lookup(result.nume);
    if (!best) return result;
    return { ...result, email_verificat: best.email, verificat_la: best.verificat_la, nota_instantiere: verifiedNote(best) };
  } catch (err) {
    console.warn(`  known institutions lookup failed for "${result.nume}":`, err instanceof Error ? err.message : String(err));
    return result;
  }
}

export async function enrichWithKnownEmails(
  results: RagInstitutionResult[],
  lookup: KnownInstitutionLookup,
): Promise<EnrichedRagResult[]> {
  return Promise.all(results.map((r) => enrichOne(r, lookup)));
}
