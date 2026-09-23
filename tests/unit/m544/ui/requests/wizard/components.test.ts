// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup, renderHook, act, waitFor } from '@testing-library/react';
import { StickyActionBar } from '@m544/ui/requests/wizard/StickyActionBar';
import { StepperBar } from '@m544/ui/requests/wizard/StepperBar';
import { StepSelectQuestions } from '@m544/ui/requests/wizard/StepSelectQuestions';
import { AttachmentsBusyHint } from '@m544/ui/requests/wizard/AttachmentsBusyHint';
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

  it('hints, without blocking, when the selection exceeds the recommended maximum', () => {
    render(createElement(StickyActionBar, { ...base, selectedCount: 12, recommendedMax: 10 }));
    expect(screen.getByText('Recomandat: cel mult 10 cereri odată')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Previzualizare/ }) as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    render(createElement(StickyActionBar, { ...base, selectedCount: 10, recommendedMax: 10 }));
    expect(screen.queryByText(/Recomandat:/)).toBeNull();
  });

  it('shows the remaining daily limit when provided', () => {
    render(createElement(StickyActionBar, { ...base, dailyLimitInfo: { remaining: 4 } }));
    expect(screen.getByText('Limită: 4 cereri rămase azi')).toBeTruthy();
  });
});

describe('AttachmentsBusyHint (Fix round 1: sursă unică, folosită şi din /requests/add)', () => {
  it('nu randează nimic cât timp show e fals', () => {
    const { container } = render(createElement(AttachmentsBusyHint, { show: false }));
    expect(container.textContent).toBe('');
  });

  it('arată textul explicativ când show e adevărat', () => {
    render(createElement(AttachmentsBusyHint, { show: true }));
    expect(screen.getByText('Așteaptă încărcarea atașamentelor sau scoate fișierele cu eroare.')).toBeTruthy();
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
    expect(screen.getByText(/Recomandăm cel mult 10 întrebări trimise odată/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Previzualizare/ }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    render(createElement(StepSelectQuestions, { wizard, questionGen, fromChat: false }));
    expect(screen.getByText(/Adaugă întrebările pe care dorești să le trimiți instituției\./)).toBeTruthy();
  });

  it('navigates with the sticky bar once questions are selected', () => {
    const hook = renderHook(() => useRequestWizard());
    act(() => hook.result.current.setQuestionsForCategory('A_FINANCIAR', ['q']));
    act(() => hook.result.current.selectAllInCategory('A_FINANCIAR'));
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

  it('manual path: a free editor instead of the A–E categories, and no generation', () => {
    const fetchQuestions = vi.fn(async () => ['nu trebuie generată']);
    const fetchSet = vi.fn(async () => ({ categories: { A_FINANCIAR: [], B_RESPONSABILITATE: [], C_PLANIFICARE: [], D_MONITORIZARE: [], E_CONFORMITATE: [] }, model: '' }));
    let wizardRef: ReturnType<typeof useRequestWizard> | null = null;
    function Manual() {
      const wizard = useRequestWizard({ initialStep: 2 });
      wizardRef = wizard;
      const questionGen = useQuestionGeneration({
        source: null,
        preloaded: null,
        problemContext: null,
        institutionName: null,
        onCategoryReady: wizard.setQuestionsForCategory,
        fetchQuestions,
        fetchSet,
      });
      return createElement(StepSelectQuestions, { wizard, questionGen, fromChat: false });
    }
    render(createElement(Manual));

    // the heading and intro fit a blank page: nothing to "select" yet
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Întrebările tale');
    expect(screen.getByText(/Adaugă întrebările pe care dorești să le trimiți instituției\./)).toBeTruthy();
    expect(screen.getByText(/Recomandăm cel mult 10 întrebări trimise odată/)).toBeTruthy();
    // no category accordions (they were the empty 0/0 screen) and nothing generated
    expect(screen.queryByRole('button', { name: /^A\. Financiar/ })).toBeNull();
    expect(screen.queryByText('0/0')).toBeNull();
    expect(fetchQuestions).not.toHaveBeenCalled();
    expect(fetchSet).not.toHaveBeenCalled();

    const add = (text: string) => {
      act(() => { fireEvent.click(screen.getByRole('button', { name: /Adaugă întrebare/ })); });
      act(() => { fireEvent.change(screen.getByPlaceholderText('Scrie întrebarea ta...'), { target: { value: text } }); });
      act(() => { fireEvent.click(screen.getByRole('button', { name: 'Adaugă' })); });
    };
    add('Care este bugetul?');
    add('Cine a semnat contractul?');
    add('Întrebare de șters');

    expect(screen.getByText('3')).toBeTruthy();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Șterge întrebarea 3' })); });
    act(() => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Întrebarea 1' }), { target: { value: 'Care este bugetul pe 2026?' } });
    });

    // preview and sending read the same state as before: selected questions, in the order written
    expect(wizardRef!.getSelectedQuestions().map((q) => q.text)).toEqual(['Care este bugetul pe 2026?', 'Cine a semnat contractul?']);
    const preview = screen.getByRole('button', { name: /Previzualizare/ });
    expect((preview as HTMLButtonElement).disabled).toBe(false);
    act(() => { fireEvent.click(preview); });
    expect(wizardRef!.currentStep).toBe(3);
  });

  it('chat path: the categories stay and the free editor is not shown', () => {
    const wizard = renderHook(() => useRequestWizard()).result.current;
    const questionGen = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, fetchQuestions: async () => [] }),
    ).result.current;
    render(createElement(StepSelectQuestions, { wizard, questionGen, fromChat: true }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Selectează întrebările');
    expect(screen.getByRole('button', { name: /^A\. Financiar/ })).toBeTruthy();
    expect(screen.queryByText(/Încă nu ai adăugat nicio întrebare/)).toBeNull();
  });

  it('shows the step-1 recap with "Modifică" when entered from the chat', () => {
    const hook = renderHook(() =>
      useRequestWizard({
        initialChatData: { institutionName: 'Primăria Pitești', institutionEmail: 'a@b.ro', conversationId: 'c1', sessionName: 'Groapă, Primăria Pitești' },
        initialStep: 2,
      }),
    );
    const questionGen = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, fetchQuestions: async () => [] }),
    ).result.current;

    render(
      createElement(StepSelectQuestions, {
        wizard: hook.result.current,
        questionGen,
        fromChat: true,
        summary: { onEdit: () => hook.result.current.setStep(1) },
      }),
    );
    const recap = screen.getByRole('region', { name: 'Rezumat cerere' });
    expect(recap.textContent).toContain('Primăria Pitești');
    expect(recap.textContent).toContain('Groapă, Primăria Pitești');
    expect(recap.textContent).toContain('necompletat'); // solicitant name not filled in this test
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Modifică/ })); });
    expect(hook.result.current.currentStep).toBe(1);
  });

  it('shows the set error with a working "Reîncearcă"', async () => {
    const wizard = renderHook(() => useRequestWizard()).result.current;
    const fetchSet = vi.fn(async () => {
      throw new Error('Generarea a eșuat');
    });
    const gen = renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, source: { conversationId: 'c1' }, fetchSet }),
    );
    await waitFor(() => expect(gen.result.current.setError).toBe('Generarea a eșuat'));

    render(createElement(StepSelectQuestions, { wizard, questionGen: gen.result.current, fromChat: true }));
    expect(screen.getByRole('alert').textContent).toContain('Generarea a eșuat');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă' })); });
    expect(fetchSet).toHaveBeenCalledTimes(2);
  });
});
