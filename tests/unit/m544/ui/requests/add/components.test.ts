// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup, renderHook, act } from '@testing-library/react';
import { SessionInfoCard } from '@m544/ui/requests/add/SessionInfoCard';
import { RateLimitInfo } from '@m544/ui/requests/add/RateLimitInfo';
import { AddRequestsQuestions } from '@m544/ui/requests/add/AddRequestsQuestions';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { useQuestionGeneration } from '@m544/ui/requests/wizard/useQuestionGeneration';

afterEach(cleanup);

describe('SessionInfoCard', () => {
  it('shows institution, email, session name and previous count', () => {
    render(
      createElement(SessionInfoCard, {
        session: { institution_name: 'Primăria X', institution_email: 'a@b.ro', name: 'Sesiunea mea', total_requests: 4 },
      }),
    );
    expect(screen.getByText('Primăria X')).toBeTruthy();
    expect(screen.getByText('a@b.ro')).toBeTruthy();
    expect(screen.getByText('Sesiune: Sesiunea mea')).toBeTruthy();
    expect(screen.getByText('4 cereri trimise anterior')).toBeTruthy();
  });

  it('omits the optional email and name', () => {
    render(createElement(SessionInfoCard, { session: { institution_name: 'Primăria X', total_requests: 0 } }));
    expect(screen.queryByText(/Sesiune:/)).toBeNull();
    expect(screen.queryByText('a@b.ro')).toBeNull();
    expect(screen.getByText('0 cereri trimise anterior')).toBeTruthy();
  });
});

describe('RateLimitInfo', () => {
  it('shows the remaining count and sent-today only when > 0', () => {
    render(createElement(RateLimitInfo, { rateLimit: { sent_today: 0, remaining: 10, limit: 10 } }));
    expect(screen.getByText(/Limita zilnică/)).toBeTruthy();
    expect(screen.queryByText(/Azi ai trimis/)).toBeNull();
    expect(screen.queryByText(/Încearcă din nou mâine/)).toBeNull();
  });

  it('turns red and says to try tomorrow when exhausted', () => {
    const { container } = render(createElement(RateLimitInfo, { rateLimit: { sent_today: 10, remaining: 0, limit: 10 } }));
    expect(screen.getByText(/Azi ai trimis/)).toBeTruthy();
    expect(screen.getByText(/Încearcă din nou mâine/)).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('bg-protest-red-50');
  });
});

describe('AddRequestsQuestions — hint-ul de ataşamente (Fix round 1)', () => {
  // /requests/add foloseşte acelaşi AttachmentsBusyHint ca StepSelectQuestions: fără el, butonul
  // de previzualizare se dezactivează din cauza unui ataşament fără nicio explicaţie vizibilă.
  function questionGen() {
    return renderHook(() =>
      useQuestionGeneration({ problemContext: null, institutionName: null, fetchQuestions: async () => [] }),
    ).result.current;
  }

  it('nu arată hint-ul fără niciun ataşament ocupat', () => {
    const wizard = renderHook(() => useRequestWizard()).result.current;
    render(createElement(AddRequestsQuestions, { wizard, questionGen: questionGen(), rateLimit: null, onBack: () => {} }));
    expect(screen.queryByText(/Așteaptă încărcarea atașamentelor/)).toBeNull();
  });

  it('arată hint-ul şi dezactivează previzualizarea cât timp o întrebare selectată are un ataşament ocupat', () => {
    const hook = renderHook(() => useRequestWizard());
    act(() => hook.result.current.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
    const id = hook.result.current.getSelectedQuestions()[0].id;
    act(() => hook.result.current.setAttachmentsBusy(id, true));

    render(
      createElement(AddRequestsQuestions, {
        wizard: hook.result.current,
        questionGen: questionGen(),
        rateLimit: null,
        onBack: () => {},
      }),
    );
    expect(screen.getByText(/Așteaptă încărcarea atașamentelor sau scoate fișierele cu eroare\./)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Previzualizare/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('scoţând întrebarea ocupată, hint-ul dispare şi previzualizarea se deblochează', () => {
    const hook = renderHook(() => useRequestWizard());
    act(() => hook.result.current.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
    const id = hook.result.current.getSelectedQuestions()[0].id;
    act(() => hook.result.current.setAttachmentsBusy(id, true));
    act(() => hook.result.current.setAttachmentsBusy(id, false));

    render(
      createElement(AddRequestsQuestions, {
        wizard: hook.result.current,
        questionGen: questionGen(),
        rateLimit: null,
        onBack: () => {},
      }),
    );
    expect(screen.queryByText(/Așteaptă încărcarea atașamentelor/)).toBeNull();
    expect((screen.getByRole('button', { name: /Previzualizare/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
