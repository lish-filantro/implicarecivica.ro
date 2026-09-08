// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup, renderHook, act } from '@testing-library/react';
import { StickyActionBar } from '@m544/ui/requests/wizard/StickyActionBar';
import { StepperBar } from '@m544/ui/requests/wizard/StepperBar';
import { StepSelectQuestions } from '@m544/ui/requests/wizard/StepSelectQuestions';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { useQuestionGeneration } from '@m544/ui/requests/wizard/useQuestionGeneration';

afterEach(cleanup);

describe('StickyActionBar', () => {
  const base = { selectedCount: 2, onBack: vi.fn(), onPreview: vi.fn(), isDisabled: false };

  it('renders the plural count and both actions', () => {
    render(createElement(StickyActionBar, base));
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('cereri selectate')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }));
    fireEvent.click(screen.getByRole('button', { name: /Previzualizare/ }));
    expect(base.onBack).toHaveBeenCalledTimes(1);
    expect(base.onPreview).toHaveBeenCalledTimes(1);
  });

  it('uses the singular for one request', () => {
    render(createElement(StickyActionBar, { ...base, selectedCount: 1 }));
    expect(screen.getByText('cerere selectată')).toBeTruthy();
  });

  it('disables the preview button when asked', () => {
    render(createElement(StickyActionBar, { ...base, isDisabled: true }));
    expect((screen.getByRole('button', { name: /Previzualizare/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Înapoi/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the remaining daily limit when provided', () => {
    render(createElement(StickyActionBar, { ...base, dailyLimitInfo: { remaining: 4 } }));
    expect(screen.getByText('Limită: 4 cereri rămase azi')).toBeTruthy();
  });
});

describe('StepperBar', () => {
  it('renders the three default steps', () => {
    render(createElement(StepperBar, { currentStep: 1 }));
    expect(screen.getByText('Date cerere')).toBeTruthy();
    expect(screen.getByText('Selectează întrebări')).toBeTruthy();
    expect(screen.getByText('Previzualizare')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('replaces completed step numbers with a check', () => {
    render(createElement(StepperBar, { currentStep: 3 }));
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('accepts custom steps', () => {
    render(createElement(StepperBar, { currentStep: 1, steps: [{ number: 1, label: 'Unu' }, { number: 2, label: 'Doi' }] }));
    expect(screen.getByText('Unu')).toBeTruthy();
    expect(screen.queryByText('Previzualizare')).toBeNull();
  });
});

describe('StepSelectQuestions', () => {
  it('renders the chat/no-chat intro and disables preview without a selection', () => {
    const wizard = renderHook(() => useRequestWizard()).result.current;
    const questionGen = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, fetchQuestions: async () => [] }),
    ).result.current;

    render(createElement(StepSelectQuestions, { wizard, questionGen, fromChat: true }));
    expect(screen.getByText(/Poți edita sau adăuga întrebări noi/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Previzualizare/ }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    render(createElement(StepSelectQuestions, { wizard, questionGen, fromChat: false }));
    expect(screen.getByText('Adaugă întrebările pe care dorești să le trimiți instituției.')).toBeTruthy();
  });

  it('navigates with the sticky bar once questions are selected', () => {
    const hook = renderHook(() => useRequestWizard());
    act(() => hook.result.current.setQuestionsForCategory('A_FINANCIAR', ['q']));
    act(() => hook.result.current.setStep(2));
    const questionGen = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, fetchQuestions: async () => [] }),
    ).result.current;

    render(createElement(StepSelectQuestions, { wizard: hook.result.current, questionGen, fromChat: false }));
    const preview = screen.getByRole('button', { name: /Previzualizare/ });
    expect((preview as HTMLButtonElement).disabled).toBe(false);
    act(() => { fireEvent.click(preview); });
    expect(hook.result.current.currentStep).toBe(3);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Înapoi/ })); });
    expect(hook.result.current.currentStep).toBe(1);
  });
});
