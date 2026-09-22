/**
 * Termenele de răspuns ale Legii 544/2001 art. 7, în forma dată de Normele metodologice
 * (HG 123/2002, art. 16 astfel cum a fost modificat prin HG 478/2016 pct. 11).
 *
 * Sunt ZILE CALENDARISTICE, calculate „pe zile libere", nu zile lucrătoare — art. 16
 * alin. (1) spune „10 zile", „30 de zile", „5 zile", fără calificativul „lucrătoare":
 *  - lit. a): 10 zile pentru comunicarea informaţiei;
 *  - lit. b): 10 zile pentru anunţarea solicitantului că termenul de la lit. a) nu a fost
 *    suficient;
 *  - lit. c): 30 de zile pentru comunicarea informaţiei identificate peste termenul de la
 *    lit. a) — plafon TOTAL de la înregistrare (art. 7 alin. (1) din Lege: „în cel mult
 *    30 de zile de la înregistrarea solicitării"), nu 10 + 30;
 *  - lit. d): 5 zile pentru transmiterea refuzului şi a motivării lui.
 *
 * Termenele curg de la data înregistrării; nu intră în calcul nici ziua de început, nici ziua
 * împlinirii (alin. (2)), iar dacă ultima zi cade într-o zi nelucrătoare termenul se
 * prelungeşte până în prima zi lucrătoare (alin. (3)). Aritmetica e în
 * `shared/utils/legal-days`; rezultatul e sfârşitul ultimei zile, `…T23:59:59.999Z`.
 *
 * `dateReceivedIso` e un instant real (momentul confirmării înregistrării), deci ziua de start
 * se citeşte în fusul României, nu în UTC — vezi antetul din `shared/utils/legal-days`.
 */
import { addLegalDays } from '@m544/shared/utils/legal-days';

export const STANDARD_DEADLINE_DAYS = 10;
export const EXTENDED_DEADLINE_DAYS = 30;
export const REFUSAL_DEADLINE_DAYS = 5;

/** 10 zile de la înregistrare — art. 16 alin. (1) lit. a) din Norme. */
export function standardDeadline(dateReceivedIso: string): string {
  return addLegalDays(dateReceivedIso, STANDARD_DEADLINE_DAYS);
}

/** 30 de zile de la înregistrare, în total — art. 16 alin. (1) lit. c) din Norme. */
export function extendedDeadline(dateReceivedIso: string): string {
  return addLegalDays(dateReceivedIso, EXTENDED_DEADLINE_DAYS);
}

/** 5 zile de la înregistrare pentru comunicarea refuzului — art. 16 alin. (1) lit. d). */
export function refusalDeadline(dateReceivedIso: string): string {
  return addLegalDays(dateReceivedIso, REFUSAL_DEADLINE_DAYS);
}
