/**
 * shared/utils/legal-days — aritmetica termenelor Legii 544/2001 în ZILE CALENDARISTICE,
 * calculate „pe zile libere" (Norme metodologice HG 123/2002, art. 16 în forma dată de
 * HG 478/2016 pct. 11): alin. (2) exclude din calcul atât ziua înregistrării, cât şi ziua
 * împlinirii (deci ultima zi e D + N + 1), iar alin. (3) prelungeşte termenul până în prima
 * zi lucrătoare când ultima zi cade sâmbăta, duminica sau într-o sărbătoare legală.
 *
 * Tabelul de 26 de cazuri e în tests/fixtures/legal-deadline-oracle.ts, în ordinea §3 din
 * specificaţie.
 */
import { describe, it, expect } from 'vitest';
import { addLegalDays, rollToBusinessDay } from '@m544/shared/utils/legal-days';
import { isBusinessDay } from '@m544/shared/utils/holidays';
import { LEGAL_DEADLINE_ORACLE, endOfDay, oracleTitle } from '../../../../fixtures/legal-deadline-oracle';

describe('rollToBusinessDay (art. 16 alin. (3) — prelungirea până în prima zi lucrătoare)', () => {
  it('lasă neatinsă o zi care e deja lucrătoare', () => {
    expect(rollToBusinessDay('2026-09-18')).toBe('2026-09-18'); // vineri obişnuită
    expect(rollToBusinessDay('2026-12-24')).toBe('2026-12-24'); // 24 dec nu e sărbătoare legală
  });

  it('ignoră ora din ISO şi întoarce doar componenta de dată UTC', () => {
    expect(rollToBusinessDay('2026-09-18T00:00:00.000Z')).toBe('2026-09-18');
    expect(rollToBusinessDay('2026-09-18T23:59:59.999Z')).toBe('2026-09-18');
  });

  it('rostogoleşte weekendul până luni', () => {
    expect(rollToBusinessDay('2026-09-19')).toBe('2026-09-21'); // sâmbătă → luni
    expect(rollToBusinessDay('2026-09-20')).toBe('2026-09-21'); // duminică → luni
  });

  it('rostogoleşte o sărbătoare legală, inclusiv una căzută în mijlocul săptămânii', () => {
    expect(rollToBusinessDay('2026-12-01')).toBe('2026-12-02'); // 1 Decembrie, marţi
    expect(rollToBusinessDay('2026-11-30')).toBe('2026-12-02'); // Sf. Andrei (luni) → 1 dec → 2 dec
    expect(rollToBusinessDay('2026-01-06')).toBe('2026-01-08'); // Boboteaza → Sf. Ioan → 8 ian
  });

  it('parcurge lanţuri lungi de zile nelucrătoare, peste ani şi peste sărbători mobile', () => {
    expect(rollToBusinessDay('2027-04-30')).toBe('2027-05-04'); // Vinerea Mare, 1 Mai, Paşte, a 2-a zi
    expect(rollToBusinessDay('2026-04-10')).toBe('2026-04-14'); // Vinerea Mare 2026 + weekend + Paşte
    expect(rollToBusinessDay('2027-01-01')).toBe('2027-01-04'); // 1 şi 2 ian + weekend
  });

  it('respinge un ISO invalid', () => {
    expect(() => rollToBusinessDay('nu-e-o-dată')).toThrow(/Invalid ISO date/);
  });
});

describe('addLegalDays — oracolul §3 (26 de cazuri)', () => {
  it.each(LEGAL_DEADLINE_ORACLE.map((c) => [oracleTitle(c), c] as const))('%s', (_title, c) => {
    expect(addLegalDays(c.received, c.n)).toBe(endOfDay(c.final));
  });

  it('acoperă exact cele 26 de cazuri din specificaţie, în ordine', () => {
    expect(LEGAL_DEADLINE_ORACLE).toHaveLength(26);
    expect(LEGAL_DEADLINE_ORACLE.map((c) => c.nr)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });

  it('ultima zi a fiecărui termen din oracol este o zi lucrătoare şi nu e niciodată mai devreme decât D + N + 1', () => {
    for (const c of LEGAL_DEADLINE_ORACLE) {
      expect(isBusinessDay(c.final)).toBe(true);
      expect(c.final >= c.raw).toBe(true);
    }
  });
});

/**
 * Ziua `D` din art. 16 alin. (2) e ziua calendaristică în care s-a înregistrat solicitarea —
 * adică ziua din calendarul românesc, nu componenta UTC a instantului. România e UTC+2 iarna
 * şi UTC+3 vara, deci instanţele de seară târziu cad deja în ziua următoare la Bucureşti.
 * Testele folosesc instanţe UTC explicite, ca să nu depindă de `TZ`-ul maşinii.
 */
describe('addLegalDays — ziua D e ziua calendaristică românească a instantului', () => {
  it('vara (UTC+3): un email sosit la 21:30Z e deja ziua următoare la Bucureşti', () => {
    // 2026-09-17T21:30Z = 18 septembrie, 00:30 în România. D = 18.09 → ultima zi 29.09 (marţi).
    // Pe ziua UTC (17.09) ar fi ieşit 28.09 — o zi în minus, în defavoarea solicitantului.
    expect(addLegalDays('2026-09-17T21:30:00.000Z', 10)).toBe('2026-09-29T23:59:59.999Z');
  });

  it('iarna (UTC+2): graniţa zilei se mută la 22:00Z, nu la 21:00Z', () => {
    // 21:30Z în ianuarie e încă 23:30, aceeaşi zi (13.01) → ultima zi 24.01, care e şi sâmbătă,
    // şi Ziua Unirii Principatelor (sărbătoare legală) → 25.01 duminică → 26.01.
    expect(addLegalDays('2026-01-13T21:30:00.000Z', 10)).toBe('2026-01-26T23:59:59.999Z');
    // 22:30Z e deja 13 ianuarie, 00:30 la Bucureşti, deşi ziua UTC e 12.01 → acelaşi termen.
    expect(addLegalDays('2026-01-12T22:30:00.000Z', 10)).toBe('2026-01-26T23:59:59.999Z');
    // Control pe aceeaşi zi UTC: la prânz ziua RO e 12.01, iar ultima zi 23.01 (vineri).
    expect(addLegalDays('2026-01-12T10:00:00.000Z', 10)).toBe('2026-01-23T23:59:59.999Z');
  });

  it('când ziua românească şi cea UTC coincid, rezultatul e neschimbat', () => {
    expect(addLegalDays('2026-09-07T10:00:00.000Z', 10)).toBe('2026-09-18T23:59:59.999Z');
    expect(addLegalDays('2026-09-07', 10)).toBe('2026-09-18T23:59:59.999Z');
  });
});

describe('addLegalDays — contract', () => {
  it('întoarce sfârşitul zilei (ora 24:00 a ultimei zile), ca `YYYY-MM-DDT23:59:59.999Z`', () => {
    expect(addLegalDays('2026-09-07', 10)).toBe('2026-09-18T23:59:59.999Z');
    expect(addLegalDays('2026-09-07', 10)).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\.999Z$/);
  });

  it('orele din aceeaşi zi românească dau acelaşi termen', () => {
    const zi = addLegalDays('2026-09-07T00:00:00.000Z', 10); // 03:00 la Bucureşti
    expect(addLegalDays('2026-09-07T13:37:42.123Z', 10)).toBe(zi);
    expect(addLegalDays('2026-09-07T20:59:00.000Z', 10)).toBe(zi); // 23:59 la Bucureşti
    expect(addLegalDays('2026-09-07', 10)).toBe(zi);
  });

  it('respinge un termen care nu e un număr întreg de zile, cel puţin 1', () => {
    expect(() => addLegalDays('2026-09-07', 0)).toThrow(/Invalid legal term/);
    expect(() => addLegalDays('2026-09-07', -1)).toThrow(/Invalid legal term/);
    expect(() => addLegalDays('2026-09-07', 2.5)).toThrow(/Invalid legal term/);
    expect(() => addLegalDays('2026-09-07', Number.NaN)).toThrow(/Invalid legal term/);
  });

  it('numără zile calendaristice, nu lucrătoare: 10 zile de luni nu ajung la 22 septembrie', () => {
    // Vechea aritmetică pe zile lucrătoare dădea 2026-09-22 pentru o cerere de luni 7 septembrie.
    expect(addLegalDays('2026-09-07', 10)).toBe('2026-09-18T23:59:59.999Z');
    expect(addLegalDays('2026-09-07', 10).slice(0, 10)).not.toBe('2026-09-22');
  });

  it('respinge un ISO invalid', () => {
    expect(() => addLegalDays('nu-e-o-dată', 10)).toThrow(/Invalid ISO date/);
  });
});
