/**
 * Termene legale Legea 544/2001 art. 7 + Norme metodologice (HG 123/2002, art. 16 astfel cum
 * a fost modificat prin HG 478/2016 pct. 11, M. Of. nr. 516 din 8 iulie 2016).
 *
 * Termenele sunt în ZILE CALENDARISTICE, calculate „pe zile libere". Textul art. 16 alin. (1)
 * spune „10 zile", „30 de zile", „5 zile" — fără calificativul „lucrătoare"; la fel art. 7
 * alin. (1) din Lege. Randările HTML care spun „10 zile lucrătoare" contrazic textul actului
 * modificator şi nu sunt o sursă.
 *
 *  - art. 16 alin. (2): termenele se calculează de la data înregistrării solicitării;
 *    „nu intră în calculul termenelor ziua de la care începe să curgă termenul, nici ziua
 *    când acesta se împlineşte". Un termen de N zile pentru o cerere înregistrată în ziua D
 *    se împlineşte deci la ora 24:00 a zilei D + N + 1.
 *  - art. 16 alin. (3): „Când ultima zi a unui termen cade într-o zi nelucrătoare, termenul
 *    se prelungeşte până în prima zi lucrătoare care urmează" — sâmbătă, duminică sau
 *    sărbătoare legală (Codul muncii art. 139, lista din `holidays.ts`).
 *
 * Zilele nelucrătoare NU se scad din numărătoare; ele doar rostogolesc ultima zi.
 *
 * ── Fusuri orare: intrările se citesc în România, valoarea stocată se citeşte în UTC ────────
 *
 * Ziua `D` este ziua din CALENDARUL ROMÂNESC a instantului de înregistrare, nu componenta UTC
 * a acestuia: România e UTC+2 iarna şi UTC+3 vara, aşa că un email de confirmare sosit la
 * 21:30Z este deja ziua următoare la Bucureşti. Citit pe ziua UTC, termenul ar porni cu o zi
 * mai devreme şi cererea ar apărea depăşită înainte de scadenţa legală — eroare în defavoarea
 * solicitantului. Acelaşi principiu se aplică oricărui alt instant real (`now`, `date_sent`)
 * în `requests/utils/deadlines`.
 *
 * Rezultatul, dimpotrivă, NU e un instant: e o zi calendaristică, codificată ca sfârşit de zi
 * UTC (`YYYY-MM-DDT23:59:59.999Z`). Toţi consumatorii îi citesc componenta de dată UTC, iar
 * `rollToBusinessDay` lucrează tot pe zile deja codificate, deci şi el pe componenta UTC.
 *
 * Consecinţa e un decalaj deliberat de 2-3 ore: `23:59:59.999Z` cade la 01:59 (iarna) sau
 * 02:59 (vara) ora Bucureştiului, adică după miezul nopţii româneşti. Diferenţa e în favoarea
 * instituţiei şi garantează că o cerere nu poate fi marcată „depăşit" înainte de expirarea
 * reală a termenului. Nu o „reparaţi" trecând valoarea stocată în oră locală fără să trataţi
 * explicit ora de vară — aţi obţine termene care se schimbă de două ori pe an.
 */
import { isBusinessDay } from './holidays';

const MS_PER_DAY = 86_400_000;

/** 'sv-SE' produce direct `YYYY-MM-DD`; `Intl` aplică singur ora de vară a României. */
const RO_CALENDAR_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' });

function parseIso(dateIso: string): Date {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${dateIso}`);
  return d;
}

/**
 * Ziua calendaristică românească (`YYYY-MM-DD`) a instantului `dateIso` — ziua `D` din
 * art. 16 alin. (2). Pentru un `YYYY-MM-DD` simplu (miezul nopţii UTC) ziua e neschimbată,
 * fiindcă România e mereu înaintea UTC.
 */
export function romanianDay(dateIso: string): string {
  return RO_CALENDAR_DAY.format(parseIso(dateIso));
}

/** Miezul nopţii UTC al zilei din `dateIso` (`YYYY-MM-DD` sau timestamp complet), în ms. */
function utcDayStart(dateIso: string): number {
  const d = parseIso(dateIso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function ymd(dayMs: number): string {
  return new Date(dayMs).toISOString().slice(0, 10);
}

/**
 * Prima zi lucrătoare mai mare sau egală cu ziua din `dateIso` — rostogolirea din art. 16
 * alin. (3). Primeşte o zi deja codificată, nu un instant real, deci se citeşte pe componenta
 * de dată UTC; întoarce doar data, `YYYY-MM-DD`.
 */
export function rollToBusinessDay(dateIso: string): string {
  let day = utcDayStart(dateIso);
  while (!isBusinessDay(ymd(day))) day += MS_PER_DAY;
  return ymd(day);
}

/**
 * Ultima zi a unui termen legal de `n` zile pentru o cerere înregistrată la `dateIso`:
 * `rollToBusinessDay(D + n + 1)`, unde `D` e ziua românească a înregistrării. Se întoarce ca
 * sfârşit de zi UTC — `YYYY-MM-DDT23:59:59.999Z` — fiindcă termenul expiră la ora 24:00.
 */
export function addLegalDays(dateIso: string, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid legal term: ${n} days`);
  const start = utcDayStart(romanianDay(dateIso));
  return `${rollToBusinessDay(ymd(start + (n + 1) * MS_PER_DAY))}T23:59:59.999Z`;
}
