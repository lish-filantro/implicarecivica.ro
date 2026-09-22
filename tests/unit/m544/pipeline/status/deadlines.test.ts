/**
 * pipeline/status/deadlines — termenele Legii 544/2001 în ZILE CALENDARISTICE, calculate
 * „pe zile libere": 10 zile pentru răspuns, cel mult 30 în total când instituţia prelungeşte,
 * 5 zile pentru refuz, toate de la data înregistrării (art. 7 alin. (1) din Lege; art. 16
 * alin. (1)-(3) din Normele metodologice, HG 123/2002 în forma dată de HG 478/2016 pct. 11).
 * Ultima zi e D + N + 1 (alin. (2) exclude ziua de început şi ziua împlinirii), rostogolită
 * în prima zi lucrătoare dacă e sâmbătă, duminică sau sărbătoare legală (alin. (3)).
 *
 * Cele 26 de cazuri sunt tabelul din tests/fixtures/legal-deadline-oracle.ts, în ordinea §3
 * din specificaţie.
 */
import { describe, it, expect } from 'vitest';
import {
  standardDeadline,
  extendedDeadline,
  refusalDeadline,
  STANDARD_DEADLINE_DAYS,
  EXTENDED_DEADLINE_DAYS,
  REFUSAL_DEADLINE_DAYS,
} from '@m544/pipeline/status/deadlines';
import {
  LEGAL_DEADLINE_ORACLE,
  endOfDay,
  oracleTitle,
  type LegalDeadlineCase,
} from '../../../../fixtures/legal-deadline-oracle';

/** Termenul din lege care corespunde numărului de zile al fiecărui caz din oracol. */
const DEADLINE_FOR: Record<LegalDeadlineCase['n'], (dateReceivedIso: string) => string> = {
  [STANDARD_DEADLINE_DAYS]: standardDeadline,
  [EXTENDED_DEADLINE_DAYS]: extendedDeadline,
  [REFUSAL_DEADLINE_DAYS]: refusalDeadline,
};

describe('Termenele Legii 544/2001 — constante', () => {
  it('10 pentru răspuns, 30 în total la prelungire, 5 pentru refuz — zile calendaristice', () => {
    expect(STANDARD_DEADLINE_DAYS).toBe(10);
    expect(EXTENDED_DEADLINE_DAYS).toBe(30);
    expect(REFUSAL_DEADLINE_DAYS).toBe(5);
  });
});

describe('standardDeadline / extendedDeadline / refusalDeadline — oracolul §3 (26 de cazuri)', () => {
  it.each(LEGAL_DEADLINE_ORACLE.map((c) => [oracleTitle(c), c] as const))('%s', (_title, c) => {
    expect(DEADLINE_FOR[c.n](c.received)).toBe(endOfDay(c.final));
  });
});

describe('standardDeadline / extendedDeadline / refusalDeadline — aserţiunile obligatorii', () => {
  it('cerere de luni 7 septembrie 2026: 10 → 18 sep, 30 → 8 oct, 5 → 14 sep (duminică rostogolită)', () => {
    expect(standardDeadline('2026-09-07T10:00:00.000Z')).toBe('2026-09-18T23:59:59.999Z');
    expect(extendedDeadline('2026-09-07T10:00:00.000Z')).toBe('2026-10-08T23:59:59.999Z');
    expect(refusalDeadline('2026-09-07T10:00:00.000Z')).toBe('2026-09-14T23:59:59.999Z');
  });

  it('ultima zi cade sâmbătă → se mută luni', () => {
    expect(standardDeadline('2026-09-08T10:00:00.000Z')).toBe('2026-09-21T23:59:59.999Z');
  });

  it('sărbătorile legale se numără, dar mută ultima zi: Vinerea Mare → Paşte 2026', () => {
    expect(standardDeadline('2026-03-30T00:00:00.000Z')).toBe('2026-04-14T23:59:59.999Z');
  });

  it('6 şi 7 ianuarie (Boboteaza, Sf. Ioan) mută ultima zi', () => {
    expect(standardDeadline('2025-12-26T00:00:00.000Z')).toBe('2026-01-08T23:59:59.999Z');
  });

  it('termenul trece pragul de an', () => {
    expect(standardDeadline('2026-12-21T00:00:00.000Z')).toBe('2027-01-04T23:59:59.999Z');
  });

  it('Paştele 2027 se suprapune cu 1 Mai — lanţ de patru zile nelucrătoare', () => {
    expect(standardDeadline('2027-04-19T00:00:00.000Z')).toBe('2027-05-04T23:59:59.999Z');
  });
});

describe('standardDeadline / extendedDeadline / refusalDeadline — contract', () => {
  it('orele din aceeaşi zi românească dau acelaşi termen', () => {
    // 00:00Z şi 20:59Z sunt 03:00 şi 23:59 la Bucureşti — aceeaşi zi de înregistrare.
    expect(standardDeadline('2026-09-07T00:00:00.000Z')).toBe(standardDeadline('2026-09-07T20:59:00.000Z'));
    expect(extendedDeadline('2026-09-07T00:00:00.000Z')).toBe(extendedDeadline('2026-09-07T20:59:00.000Z'));
    expect(refusalDeadline('2026-09-07T00:00:00.000Z')).toBe(refusalDeadline('2026-09-07T20:59:00.000Z'));
  });

  it('o înregistrare de după miezul nopţii româneşti porneşte din ziua următoare', () => {
    // 2026-09-07T23:00Z = 8 septembrie, 02:00 în România (UTC+3): D = 08.09, nu 07.09.
    // Vezi shared/utils/legal-days — instanţele reale se citesc în fusul României.
    expect(standardDeadline('2026-09-07T23:00:00.000Z')).toBe('2026-09-21T23:59:59.999Z');
    expect(standardDeadline('2026-09-07T10:00:00.000Z')).toBe('2026-09-18T23:59:59.999Z');
  });

  it('termenul expiră la ora 24:00 a ultimei zile — se stochează ca sfârşit de zi UTC', () => {
    for (const deadline of [standardDeadline, extendedDeadline, refusalDeadline]) {
      expect(deadline('2026-09-07T10:00:00.000Z')).toMatch(/T23:59:59\.999Z$/);
    }
  });

  it('prelungirea e un plafon TOTAL de la înregistrare, nu 10 + 30 de zile peste termenul standard', () => {
    const received = '2026-09-07T10:00:00.000Z';
    const zi = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);
    const zileIntre = (a: string, b: string) => (zi(b) - zi(a)) / 86_400_000;
    // 7 sep → 8 oct: 30 de zile de la înregistrare plus ziua împlinirii, care nu intră în calcul.
    expect(zileIntre(received, extendedDeadline(received))).toBe(EXTENDED_DEADLINE_DAYS + 1);
    expect(new Date(extendedDeadline(received)) > new Date(standardDeadline(received))).toBe(true);
  });
});
