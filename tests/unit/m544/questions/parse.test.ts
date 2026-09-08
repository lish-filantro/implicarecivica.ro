/**
 * questions/parse — turns the model's free text into a clean list of questions.
 * Cases mirror real Haiku outputs: numbered, bulleted, with a heading line.
 */
import { describe, it, expect } from 'vitest';
import { parseQuestions } from '@m544/questions/parse';

const Q1 = 'Vă rog să îmi furnizați bugetul alocat reparațiilor stradale în 2025.';
const Q2 = 'Solicit informații despre contractele de achiziții publice semnate în 2024.';
const Q3 = 'Vă rog să îmi comunicați lista firmelor care au executat lucrări pe strada X.';

describe('parseQuestions', () => {
  it('strips "1." / "2)" numbering and keeps the order', () => {
    expect(parseQuestions(`1. ${Q1}\n2) ${Q2}\n10. ${Q3}`)).toEqual([Q1, Q2, Q3]);
  });

  it('strips "-", "•" and "*" bullets', () => {
    expect(parseQuestions(`- ${Q1}\n• ${Q2}\n* ${Q3}`)).toEqual([Q1, Q2, Q3]);
  });

  it('drops heading lines ("Întrebări...", "Categoria...") and blank lines', () => {
    const text = `Întrebări pentru categoria A. Financiar:\n\nCategoria A - Financiar\n1. ${Q1}\n\n2. ${Q2}\n`;
    expect(parseQuestions(text)).toEqual([Q1, Q2]);
  });

  it('drops very short fragments (<= 10 chars) and trims whitespace', () => {
    expect(parseQuestions(`1.   ${Q1}   \n2. ok\n3. -\n`)).toEqual([Q1]);
  });

  it('accepts indented numbering', () => {
    expect(parseQuestions(`   1.  ${Q1}\n\t2. ${Q2}`)).toEqual([Q1, Q2]);
  });

  it('returns [] for empty output', () => {
    expect(parseQuestions('')).toEqual([]);
    expect(parseQuestions('\n\n')).toEqual([]);
  });
});
