/**
 * chat/validation/institution — the structured institution read from a STEP_2
 * answer (name, best-scored email, confidence, matching source URL).
 */
import { describe, it, expect } from 'vitest';
import { extractInstitution } from '@m544/chat/validation/institution';

const REPLY = `Am identificat instituția responsabilă.

🏛️ **INSTITUȚIE_IDENTIFICATĂ:** **Primăria Municipiului Pitești**
📧 Email pentru cereri: primaria@primariapitesti.ro
🔗 Sursa: https://www.primariapitesti.ro/contact

Confirmă instituția identificată?`;

describe('extractInstitution', () => {
  it('is null without the marker', () => {
    expect(extractInstitution('Ce problemă aveți și unde?', ['https://x.ro'])).toBeNull();
  });

  it('is null when the marker carries no name', () => {
    expect(extractInstitution('🏛INSTITUȚIE_IDENTIFICATĂ: ** **\n', [])).toBeNull();
  });

  it('reads name, email, confidence and the source on the email domain', () => {
    const inst = extractInstitution(REPLY, ['https://www.google.com/search?q=x', 'https://www.primariapitesti.ro/contact']);
    expect(inst).toMatchObject({
      name: 'Primăria Municipiului Pitești',
      email: 'primaria@primariapitesti.ro',
      sourceUrl: 'https://www.primariapitesti.ro/contact',
    });
    expect(['high', 'medium']).toContain(inst!.confidence);
  });

  it('handles the "Tip:" prefix and a reply without email', () => {
    const inst = extractInstitution('🏛INSTITUȚIE_IDENTIFICATĂ: Tip: Consiliul Județean Argeș\nNu am găsit adresa online.', []);
    expect(inst).toEqual({ name: 'Consiliul Județean Argeș', email: null, confidence: null, sourceUrl: null });
  });

  it('stops the name at the email icon on the same line', () => {
    const inst = extractInstitution('🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Brașov 📧 office@brasovcity.ro', []);
    expect(inst!.name).toBe('Primăria Brașov');
  });

  it('picks the best-scored email when several appear', () => {
    const text = '🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Pitești\nScrieți la contact@gmail.com sau la registratura@primariapitesti.ro (Legea 544).';
    const inst = extractInstitution(text, []);
    expect(inst!.email).toBe('registratura@primariapitesti.ro');
    expect(inst!.sourceUrl).toBeNull();
  });

  it('falls back to the first non-search-engine source when no host matches the email', () => {
    const inst = extractInstitution(REPLY, ['https://www.google.com/search?q=x', 'https://www.bing.com/y', 'https://cjarges.ro/legea-544']);
    expect(inst!.sourceUrl).toBe('https://cjarges.ro/legea-544');
  });

  it('rates a gmail address as low confidence', () => {
    const inst = extractInstitution('🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Comunei X\nEmail: primariax@gmail.com', []);
    expect(inst).toMatchObject({ email: 'primariax@gmail.com', confidence: 'low' });
  });
});
