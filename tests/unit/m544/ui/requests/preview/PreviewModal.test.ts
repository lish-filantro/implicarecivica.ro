// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, renderHook, act, screen, waitFor, cleanup } from '@testing-library/react';
import { PreviewModal } from '@m544/ui/requests/preview/PreviewModal';
import { RateLimitNotice } from '@m544/ui/requests/preview/RateLimitNotice';
import { SendProgress } from '@m544/ui/requests/preview/SendProgress';
import { PreviewEmailCard } from '@m544/ui/requests/preview/PreviewEmailCard';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { FOIA_MESSAGES } from '@m544/ui/requests/preview/foia-messages';
import type { WizardFormData } from '@m544/ui/requests/wizard/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const FORM: WizardFormData = {
  solicitantName: 'Ion Popescu',
  solicitantEmail: 'ion@mail.ro',
  solicitantAddress: 'Str. Victoriei 10',
  saveAddress: false,
  institutionName: 'Primăria Pitești',
  institutionEmail: 'registratura@primaria.ro',
  sessionName: 'Transparență',
};

function stubRateLimit(remaining: number | null) {
  const fetchFn = vi.fn(async () =>
    remaining === null
      ? new Response('nope', { status: 500 })
      : new Response(JSON.stringify({ sent_today: 10 - remaining, remaining, limit: 10 })),
  );
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

/** A real wizard with `n` selected custom questions and a filled form. */
function wizardWith(n: number) {
  const { result } = renderHook(() => useRequestWizard());
  act(() => {
    for (let i = 0; i < n; i++) result.current.addCustomQuestion('A_FINANCIAR', `Întrebarea ${i + 1}`);
    for (const [k, v] of Object.entries(FORM)) result.current.updateFormField(k as keyof WizardFormData, v as never);
  });
  return result.current;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PreviewModal', () => {
  beforeEach(() => {
    // Radix Dialog scroll-lock/focus helpers not present in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders one preview card per selected question and the send button with the count', async () => {
    stubRateLimit(8);
    render(createElement(PreviewModal, { wizard: wizardWith(3), onClose: vi.fn() }));

    expect(screen.getAllByText(/Cererea \d din 3/)).toHaveLength(3);
    expect(screen.getByText(/3 emailuri separate/)).toBeTruthy();
    expect(screen.getByText(/interval de 30 de secunde/)).toBeTruthy();
    expect(screen.getByText(/Poți închide această fereastră/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Închide' })).toBeTruthy();

    const send = screen.getByRole('button', { name: /Trimite toate cele 3/ });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText(/Mai poți trimite/)).toBeTruthy();
    expect(screen.queryByText(/dar mai poți trimite doar/)).toBeNull();
  });

  it('disables the send button and explains when the selection exceeds the daily limit', async () => {
    stubRateLimit(1);
    render(createElement(PreviewModal, { wizard: wizardWith(2), onClose: vi.fn() }));

    const send = screen.getByRole('button', { name: /Trimite toate cele 2/ });
    await waitFor(() => expect(screen.getByText(/Ai selectat 2 cereri, dar mai poți trimite doar 1/)).toBeTruthy());
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Reduce numărul de cereri selectate/)).toBeTruthy();
  });

  it('with the limit exhausted, says to try tomorrow', async () => {
    stubRateLimit(0);
    render(createElement(PreviewModal, { wizard: wizardWith(1), onClose: vi.fn() }));
    await waitFor(() => expect(screen.getByText(/Încearcă din nou mâine/)).toBeTruthy());
    expect((screen.getByRole('button', { name: /Trimite toate cele 1/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps sending allowed (no notice) when the limit check fails', async () => {
    stubRateLimit(null);
    render(createElement(PreviewModal, { wizard: wizardWith(1), onClose: vi.fn() }));
    const send = screen.getByRole('button', { name: /Trimite toate cele 1/ });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText(/Limita zilnică/)).toBeNull();
  });

  it('the Anulează button calls onClose', async () => {
    stubRateLimit(5);
    const onClose = vi.fn();
    render(createElement(PreviewModal, { wizard: wizardWith(1), onClose }));
    await act(async () => {});
    screen.getByRole('button', { name: 'Anulează' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RateLimitNotice', () => {
  it('shows sent-today only when > 0', () => {
    const { rerender } = render(
      createElement(RateLimitNotice, { rateLimit: { sent_today: 0, remaining: 10, limit: 10 }, selectedCount: 2, exceedsLimit: false }),
    );
    expect(screen.queryByText(/Azi ai trimis/)).toBeNull();
    rerender(
      createElement(RateLimitNotice, { rateLimit: { sent_today: 4, remaining: 6, limit: 10 }, selectedCount: 2, exceedsLimit: false }),
    );
    expect(screen.getByText(/Azi ai trimis/)).toBeTruthy();
  });
});

describe('SendProgress', () => {
  it('renders the counter, a FOIA message and the countdown', () => {
    render(createElement(SendProgress, { sent: 1, total: 3, secondsLeft: 12 }));
    expect(screen.getByText('Trimitere: 1/3')).toBeTruthy();
    expect(screen.getByText('Nu reîncărca pagina')).toBeTruthy();
    expect(screen.getByText(new RegExp(FOIA_MESSAGES[0].slice(0, 20)))).toBeTruthy();
    expect(screen.getByText('12s')).toBeTruthy();
  });

  it('hides the countdown and the warning when done', () => {
    render(createElement(SendProgress, { sent: 3, total: 3, secondsLeft: null }));
    expect(screen.queryByText(/Următorul email/)).toBeNull();
    expect(screen.queryByText('Nu reîncărca pagina')).toBeNull();
  });
});

describe('PreviewEmailCard', () => {
  it('expands only the first card by default and shows the recipient and subject', () => {
    render(createElement(PreviewEmailCard, { index: 0, total: 2, question: 'Care e bugetul?', formData: FORM }));
    expect(screen.getByText('Cererea 1 din 2')).toBeTruthy();
    expect(screen.getByText(FORM.institutionEmail)).toBeTruthy();
    expect(screen.getByText(/Care e bugetul\?/)).toBeTruthy();
    cleanup();
    render(createElement(PreviewEmailCard, { index: 1, total: 2, question: 'Care e bugetul?', formData: FORM }));
    expect(screen.queryByText(/Care e bugetul\?/)).toBeNull();
  });
});
