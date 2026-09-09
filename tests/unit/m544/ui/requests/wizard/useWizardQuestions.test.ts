// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardQuestions, createQuestionIdGenerator } from '@m544/ui/requests/wizard/useWizardQuestions';
import { CATEGORY_IDS } from '@m544/ui/requests/wizard/types';

function setup() {
  return renderHook(() => useWizardQuestions());
}

describe('createQuestionIdGenerator', () => {
  it('produces unique ids within an instance', () => {
    const next = createQuestionIdGenerator('t');
    const ids = new Set(Array.from({ length: 500 }, () => next()));
    expect(ids.size).toBe(500);
    expect([...ids][0]).toBe('q_t_1');
  });

  it('produces distinct ids across instances (random token)', () => {
    const a = createQuestionIdGenerator();
    const b = createQuestionIdGenerator();
    expect(a()).not.toBe(b());
  });
});

describe('useWizardQuestions', () => {
  it('starts with empty categories and nothing selected', () => {
    const { result } = setup();
    for (const cat of CATEGORY_IDS) expect(result.current.questions[cat]).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.canProceedToStep3).toBe(false);
  });

  it('setQuestionsForCategory creates items with unique ids and auto-selects them', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['Q1', 'Q2', 'Q3']));
    const items = result.current.questions.A_FINANCIAR;
    expect(items.map((q) => q.text)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(items.every((q) => q.category === 'A_FINANCIAR' && !q.isCustom && !q.isEdited)).toBe(true);
    expect(new Set(items.map((q) => q.id)).size).toBe(3);
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.selectedCountByCategory.A_FINANCIAR).toBe(3);
    expect(result.current.canProceedToStep3).toBe(true);
  });

  it('ids stay unique across categories and across two hook instances', () => {
    const one = setup();
    const two = setup();
    act(() => {
      one.result.current.setQuestionsForCategory('A_FINANCIAR', ['a', 'b']);
      one.result.current.setQuestionsForCategory('B_RESPONSABILITATE', ['c', 'd']);
      two.result.current.setQuestionsForCategory('A_FINANCIAR', ['e', 'f']);
    });
    const all = [
      ...one.result.current.questions.A_FINANCIAR,
      ...one.result.current.questions.B_RESPONSABILITATE,
      ...two.result.current.questions.A_FINANCIAR,
    ].map((q) => q.id);
    expect(new Set(all).size).toBe(6);
  });

  it('setQuestionsForCategory replaces the category list (regeneration)', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['old']));
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['new1', 'new2']));
    expect(result.current.questions.A_FINANCIAR.map((q) => q.text)).toEqual(['new1', 'new2']);
    expect(result.current.selectedCountByCategory.A_FINANCIAR).toBe(2);
  });

  it('regeneration keeps the custom questions of the category', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['old']));
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'mine'));
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['new']));
    expect(result.current.questions.A_FINANCIAR.map((q) => q.text)).toEqual(['new', 'mine']);
    expect(result.current.selectedCountByCategory.A_FINANCIAR).toBe(2);
  });

  it('toggleQuestion flips selection', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('C_PLANIFICARE', ['x']));
    const id = result.current.questions.C_PLANIFICARE[0].id;
    act(() => result.current.toggleQuestion(id));
    expect(result.current.selectedQuestionIds.has(id)).toBe(false);
    expect(result.current.canProceedToStep3).toBe(false);
    act(() => result.current.toggleQuestion(id));
    expect(result.current.selectedQuestionIds.has(id)).toBe(true);
  });

  it('selectAll / deselectAll act only on the given category', () => {
    const { result } = setup();
    act(() => {
      result.current.setQuestionsForCategory('A_FINANCIAR', ['a1', 'a2']);
      result.current.setQuestionsForCategory('B_RESPONSABILITATE', ['b1']);
    });
    act(() => result.current.deselectAllInCategory('A_FINANCIAR'));
    expect(result.current.selectedCountByCategory).toMatchObject({ A_FINANCIAR: 0, B_RESPONSABILITATE: 1 });
    act(() => result.current.selectAllInCategory('A_FINANCIAR'));
    expect(result.current.selectedCountByCategory).toMatchObject({ A_FINANCIAR: 2, B_RESPONSABILITATE: 1 });
    expect(result.current.selectedCount).toBe(3);
  });

  it('editQuestion changes the text and flags generated questions as edited', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('D_MONITORIZARE', ['orig']));
    const id = result.current.questions.D_MONITORIZARE[0].id;
    act(() => result.current.editQuestion(id, 'changed'));
    expect(result.current.questions.D_MONITORIZARE[0]).toMatchObject({ text: 'changed', isEdited: true, isCustom: false });
  });

  it('editing a custom question keeps it custom and not "edited"', () => {
    const { result } = setup();
    act(() => result.current.addCustomQuestion('E_CONFORMITATE', 'mine'));
    const id = result.current.questions.E_CONFORMITATE[0].id;
    act(() => result.current.editQuestion(id, 'mine v2'));
    expect(result.current.questions.E_CONFORMITATE[0]).toMatchObject({ text: 'mine v2', isEdited: false, isCustom: true });
  });

  it('addCustomQuestion appends a selected custom item', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['gen']));
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'custom'));
    const items = result.current.questions.A_FINANCIAR;
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ text: 'custom', isCustom: true, isEdited: false, category: 'A_FINANCIAR' });
    expect(result.current.selectedQuestionIds.has(items[1].id)).toBe(true);
    expect(items[0].id).not.toBe(items[1].id);
  });

  it('removeQuestion drops the item and its selection', () => {
    const { result } = setup();
    act(() => result.current.addCustomQuestion('B_RESPONSABILITATE', 'to remove'));
    const id = result.current.questions.B_RESPONSABILITATE[0].id;
    act(() => result.current.removeQuestion(id));
    expect(result.current.questions.B_RESPONSABILITATE).toEqual([]);
    expect(result.current.selectedQuestionIds.has(id)).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('getSelectedQuestions returns selected items in category order', () => {
    const { result } = setup();
    act(() => {
      result.current.setQuestionsForCategory('E_CONFORMITATE', ['e1']);
      result.current.setQuestionsForCategory('A_FINANCIAR', ['a1', 'a2']);
    });
    act(() => result.current.toggleQuestion(result.current.questions.A_FINANCIAR[0].id));
    expect(result.current.getSelectedQuestions().map((q) => q.text)).toEqual(['a2', 'e1']);
  });
});
