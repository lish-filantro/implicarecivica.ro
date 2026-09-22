/**
 * Randarea denumirilor de instituţii. Template-urile poartă placeholdere (`{JUDET}`,
 * `{LOCALITATE}`) care se scot la afişarea în lista generică; scoaterea lor nu are voie să
 * lipească cuvintele vecine şi nici să lase o intrare fără nume.
 *
 * Aserţiunile rulează peste TOT datasetul, nu peste exemple alese de mână: bugul raportat
 * („Comisariatul Judeţuluial Gărzii Naţionale de Mediu") a scăpat fiindcă exemplele testate
 * aveau placeholderul la final, unde defectul nu se vede.
 */
import { describe, it, expect } from 'vitest';
import { getAllInstitutii } from '@/lib/institutii/load';

const institutii = getAllInstitutii();

describe('getAllInstitutii — denumiri', () => {
  it('încarcă tot datasetul', () => {
    expect(institutii.length).toBeGreaterThan(80);
  });

  it('nu lasă niciun nume gol', () => {
    const goale = institutii.filter((i) => !i.nume_oficial.trim() || !i.nume_scurt.trim());
    expect(goale.map((i) => i.id)).toEqual([]);
  });

  it('nu lasă urme de placeholder', () => {
    const cuAcolade = institutii.filter(
      (i) => /[{}]/.test(i.nume_oficial) || /[{}]/.test(i.nume_scurt),
    );
    expect(cuAcolade.map((i) => i.id)).toEqual([]);
  });

  it('nu lasă spaţii duble sau spaţii la capete', () => {
    const rele = institutii.filter(
      (i) =>
        /\s{2}/.test(i.nume_oficial) ||
        i.nume_oficial !== i.nume_oficial.trim() ||
        /\s{2}/.test(i.nume_scurt) ||
        i.nume_scurt !== i.nume_scurt.trim(),
    );
    expect(rele.map((i) => i.id)).toEqual([]);
  });

  // Cuvintele lipite nu se pot detecta cu un tipar („Județului" + „al" = „Județuluial" e literă
  // mică lângă literă mică). Le fixăm ca valori exacte, calculate din sursă pe 2026-09-22.
  it.each([
    ['COMISARIAT_GARDA_MEDIU_TEMPLATE', 'Comisariatul Județului al Gărzii Naționale de Mediu'],
    ['CENTRU_JUDETEAN_APIA_TEMPLATE', 'Centrul Județean al APIA'],
    [
      'DJFP_TEMPLATE',
      'Direcția Generală Regională a Finanțelor Publice - Administrația Județeană a Finanțelor Publice',
    ],
  ])('randează %s fără cuvinte lipite', (id, asteptat) => {
    expect(institutii.find((i) => i.id === id)?.nume_oficial).toBe(asteptat);
  });

  it('nu lipeşte cuvintele nici în numele scurt', () => {
    expect(institutii.find((i) => i.id === 'DGITL_TEMPLATE')?.nume_scurt).toBe(
      'DGITL sau Serviciul Fiscal Local',
    );
  });

  it('dă un nume şi intrării al cărei nume era numai placeholdere', () => {
    // `{TIP_SCOALA} {NUME_SCOALA}` — rândul gol din raportul de testare. Cade pe tip_institutie.
    const scoala = institutii.find((i) => i.id === 'SCOALA_PUBLICA_TEMPLATE');
    expect(scoala?.nume_oficial).toBe('Școală Publică / Liceu Public');
    expect(scoala?.nume_scurt).toBe('Școală Publică / Liceu Public');
  });
});
