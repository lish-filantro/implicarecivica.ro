// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRequestWizard, CATEGORIES } from '@m544/ui/requests/wizard/useRequestWizard';

/** The public surface consumed by StepFormData, StepSelectQuestions, PreviewModal and the pages. */
const EXPECTED_KEYS = [
  'currentStep',
  'setStep',
  'formData',
  'updateFormField',
  'initFormFromProfile',
  'questions',
  'setQuestionsForCategory',
  'selectedQuestionIds',
  'toggleQuestion',
  'selectAllInCategory',
  'deselectAllInCategory',
  'editQuestion',
  'addCustomQuestion',
  'removeQuestion',
  'selectedCount',
  'selectedCountByCategory',
  'getSelectedQuestions',
  'canProceedToStep2',
  'canProceedToStep3',
  'conversationId',
].sort();

describe('useRequestWizard (composition)', () => {
  it('exposes exactly the legacy return shape', () => {
    const { result } = renderHook(() => useRequestWizard());
    expect(Object.keys(result.current).sort()).toEqual(EXPECTED_KEYS);
  });

  it('starts on step 1 and navigates', () => {
    const { result } = renderHook(() => useRequestWizard());
    expect(result.current.currentStep).toBe(1);
    act(() => result.current.setStep(3));
    expect(result.current.currentStep).toBe(3);
  });

  it('carries the chat conversation id and institution', () => {
    const { result } = renderHook(() =>
      useRequestWizard({ initialChatData: { conversationId: 'conv-1', institutionName: 'Prim', institutionEmail: 'a@b.ro' } }),
    );
    expect(result.current.conversationId).toBe('conv-1');
    expect(result.current.formData.institutionName).toBe('Prim');
  });

  it('conversationId is null without chat data', () => {
    const { result } = renderHook(() => useRequestWizard({ initialChatData: null }));
    expect(result.current.conversationId).toBeNull();
  });

  it('re-exports CATEGORIES for the components', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'A_FINANCIAR',
      'B_RESPONSABILITATE',
      'C_PLANIFICARE',
      'D_MONITORIZARE',
      'E_CONFORMITATE',
    ]);
  });
});
