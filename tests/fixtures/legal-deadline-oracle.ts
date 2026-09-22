/**
 * Oracolul termenelor Legii 544/2001 — 26 de cazuri cu date exacte.
 *
 * Regula (Norme metodologice HG 123/2002, art. 16, în forma dată de HG 478/2016 pct. 11,
 * M. Of. nr. 516 din 8 iulie 2016):
 *  - alin. (1): termenele sunt de 10 zile (răspuns), 30 de zile (răspuns peste termenul de 10),
 *    5 zile (refuz) — ZILE CALENDARISTICE, textul nu spune „lucrătoare";
 *  - alin. (2): termenele curg de la data înregistrării solicitării, iar în calcul nu intră
 *    nici ziua de la care începe să curgă termenul, nici ziua când acesta se împlineşte
 *    (termen „pe zile libere") → ultima zi este D + N + 1;
 *  - alin. (3): când ultima zi cade într-o zi nelucrătoare, termenul se prelungeşte până în
 *    prima zi lucrătoare care urmează (sâmbătă, duminică sau sărbătoare legală — Codul
 *    muncii art. 139).
 *
 * Coloanele oglindesc §3 din SPEC-termene-544.md, în aceeaşi ordine, ca tabelul să poată fi
 * comparat rând cu rând cu specificaţia. `raw` (D + N + 1, înainte de rostogolire) şi `reason`
 * nu sunt aserţiuni în sine — sunt documentaţia motivului pentru care `final` diferă de `raw`.
 */

export interface LegalDeadlineCase {
  /** Numărul rândului din §3 al specificaţiei. */
  nr: number;
  /** Data înregistrării solicitării (art. 16 alin. (2)), `YYYY-MM-DD`. */
  received: string;
  /** Termenul legal în zile: 10 (răspuns), 30 (răspuns prelungit) sau 5 (refuz). */
  n: 5 | 10 | 30;
  /** D + N + 1 înainte de rostogolire — ultima zi „brută" a termenului. */
  raw: string;
  /** De ce se rostogoleşte (sau „—" când ultima zi e deja lucrătoare). */
  reason: string;
  /** Ultima zi a termenului, după rostogolirea din alin. (3). */
  final: string;
}

export const LEGAL_DEADLINE_ORACLE: readonly LegalDeadlineCase[] = [
  // §3.1 Bază, fără rostogolire
  { nr: 1, received: '2026-09-07', n: 10, raw: '2026-09-18', reason: '—', final: '2026-09-18' },
  { nr: 2, received: '2026-09-07', n: 30, raw: '2026-10-08', reason: '—', final: '2026-10-08' },
  { nr: 3, received: '2026-09-07', n: 5, raw: '2026-09-13', reason: 'duminică', final: '2026-09-14' },
  { nr: 4, received: '2026-09-08', n: 5, raw: '2026-09-14', reason: '—', final: '2026-09-14' },
  { nr: 5, received: '2026-09-08', n: 30, raw: '2026-10-09', reason: '—', final: '2026-10-09' },

  // §3.2 Ultima zi cade sâmbătă / duminică
  { nr: 6, received: '2026-09-08', n: 10, raw: '2026-09-19', reason: 'sâmbătă → duminică', final: '2026-09-21' },
  { nr: 7, received: '2026-09-09', n: 10, raw: '2026-09-20', reason: 'duminică', final: '2026-09-21' },
  { nr: 8, received: '2026-03-30', n: 5, raw: '2026-04-05', reason: 'duminică', final: '2026-04-06' },

  // §3.3 Sărbătoare legală fixă
  { nr: 9, received: '2026-11-19', n: 10, raw: '2026-11-30', reason: '30 nov Sf. Andrei → 1 dec', final: '2026-12-02' },
  { nr: 10, received: '2026-11-25', n: 5, raw: '2026-12-01', reason: '1 decembrie', final: '2026-12-02' },
  {
    nr: 11,
    received: '2026-12-14',
    n: 10,
    raw: '2026-12-25',
    reason: '25 dec → 26 dec (sâmbătă + Crăciun) → 27 (duminică)',
    final: '2026-12-28',
  },
  {
    nr: 12,
    received: '2026-12-13',
    n: 10,
    raw: '2026-12-24',
    reason: '— (24 dec NU e sărbătoare legală)',
    final: '2026-12-24',
  },

  // §3.4 Sărbătoare mobilă (Paşte ortodox 2026-04-12, 2027-05-02; Rusalii = Paşte + 49/50)
  {
    nr: 13,
    received: '2026-04-01',
    n: 10,
    raw: '2026-04-12',
    reason: 'duminică + Paşte → 13 apr a 2-a zi',
    final: '2026-04-14',
  },
  {
    nr: 14,
    received: '2026-05-21',
    n: 10,
    raw: '2026-06-01',
    reason: 'a 2-a zi de Rusalii / 1 iunie',
    final: '2026-06-02',
  },
  {
    nr: 15,
    received: '2026-05-19',
    n: 10,
    raw: '2026-05-30',
    reason: 'sâmbătă → 31 mai (duminică + Rusalii) → 1 iun',
    final: '2026-06-02',
  },
  { nr: 16, received: '2027-06-15', n: 5, raw: '2027-06-21', reason: 'a 2-a zi de Rusalii', final: '2027-06-22' },

  // §3.5 Prag de an (peste 1, 2, 6, 7 ianuarie)
  {
    nr: 17,
    received: '2025-12-22',
    n: 10,
    raw: '2026-01-02',
    reason: '2 ian → 3 (sâmbătă) → 4 (duminică)',
    final: '2026-01-05',
  },
  { nr: 18, received: '2025-12-26', n: 10, raw: '2026-01-06', reason: '6 ian Boboteaza → 7 ian Sf. Ioan', final: '2026-01-08' },
  { nr: 19, received: '2025-12-29', n: 5, raw: '2026-01-04', reason: 'duminică', final: '2026-01-05' },
  {
    nr: 20,
    received: '2026-12-21',
    n: 10,
    raw: '2027-01-01',
    reason: '1 ian → 2 ian (sâmbătă + 2 ian) → 3 (duminică)',
    final: '2027-01-04',
  },
  { nr: 21, received: '2026-12-28', n: 5, raw: '2027-01-03', reason: 'duminică', final: '2027-01-04' },
  { nr: 22, received: '2026-12-31', n: 10, raw: '2027-01-11', reason: '—', final: '2027-01-11' },

  // §3.6 Lanţuri lungi de zile nelucrătoare — cazurile-cheie de regresie
  {
    nr: 23,
    received: '2026-03-30',
    n: 10,
    raw: '2026-04-10',
    reason: 'Vinerea Mare → 11 (sâmbătă) → 12 (duminică + Paşte) → 13 (a 2-a zi) = 4 zile',
    final: '2026-04-14',
  },
  {
    nr: 24,
    received: '2027-04-19',
    n: 10,
    raw: '2027-04-30',
    reason: 'Vinerea Mare → 1 mai (sâmbătă + 1 Mai) → 2 mai (duminică + Paşte) → 3 mai (a 2-a zi) = 4 zile',
    final: '2027-05-04',
  },
  {
    nr: 25,
    received: '2027-04-25',
    n: 5,
    raw: '2027-05-01',
    reason: 'sâmbătă + 1 Mai → 2 mai → 3 mai',
    final: '2027-05-04',
  },
  { nr: 26, received: '2026-01-01', n: 30, raw: '2026-02-01', reason: 'duminică', final: '2026-02-02' },
];

/** Titlul unui rând, în formatul coloanelor din §3: „#nr înregistrare + N zile → brut (motiv) → final". */
export function oracleTitle(c: LegalDeadlineCase): string {
  return `#${c.nr} ${c.received} + ${c.n} zile → brut ${c.raw} (${c.reason}) → ${c.final}`;
}

/** Sfârşitul zilei `YYYY-MM-DD`, aşa cum se stochează termenul: ora 24:00 a ultimei zile. */
export function endOfDay(dateYmd: string): string {
  return `${dateYmd}T23:59:59.999Z`;
}
