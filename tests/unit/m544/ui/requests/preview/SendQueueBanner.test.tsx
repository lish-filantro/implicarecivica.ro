// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SendQueueBanner, DONE_VISIBLE_MS } from '@m544/ui/requests/preview/SendQueueBanner';
import { startSend, getSendQueueState, resetSendQueue } from '@m544/ui/requests/preview/send-queue-store';
import type { QuestionItem, WizardFormData } from '@m544/ui/requests/wizard/types';

const FORM: WizardFormData = {
  solicitantName: 'Ion',
  solicitantEmail: 'ion@mail.ro',
  solicitantAddress: 'Str. X 1',
  saveAddress: false,
  institutionName: 'Primăria Pitești',
  institutionEmail: 'a@b.ro',
  sessionName: 'S',
};
const Q: QuestionItem[] = [
  { id: 'a', category: 'A_FINANCIAR', text: 'q1', isCustom: false, isEdited: false },
  { id: 'b', category: 'A_FINANCIAR', text: 'q2', isCustom: false, isEdited: false },
];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  resetSendQueue();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('SendQueueBanner', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<SendQueueBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the counter and the countdown while sending, then the done state with a dashboard link', async () => {
    let release!: () => void;
    const sleep = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const fetchFn = vi.fn(async (url: string) =>
      url === '/api/sessions/create' ? json(200, { session: { id: 'S1' }, requests: [{ id: 'r1' }, { id: 'r2' }] }) : json(200, {}),
    ) as unknown as typeof fetch;

    render(<SendQueueBanner />);
    let run!: Promise<boolean>;
    await act(async () => {
      run = startSend({ selectedQuestions: Q, formData: FORM, conversationId: null }, { fetch: fetchFn, sleep, markHandoffSession: async () => {} });
      await new Promise((r) => setTimeout(r, 0));
    });
    const status = screen.getByRole('status', { name: 'Trimiterea cererilor' });
    expect(status.textContent).toContain('Se trimit cererile către Primăria Pitești');
    expect(status.textContent).toContain('1/2');
    expect(status.textContent).toContain('Următorul email în 30s');

    await act(async () => {
      release();
      await run;
    });
    expect(screen.getByText(/Toate cele 2 cereri au fost trimise/)).toBeTruthy();
    expect(screen.getByText('Vezi în dashboard').getAttribute('href')).toBe('/dashboard');

    fireEvent.click(screen.getByRole('button', { name: 'Închide' }));
    expect(getSendQueueState().status).toBe('idle');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides the done state by itself after DONE_VISIBLE_MS', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async (url: string) =>
      url === '/api/sessions/create' ? json(200, { requests: [{ id: 'r1' }] }) : json(200, {}),
    ) as unknown as typeof fetch;
    render(<SendQueueBanner />);
    await act(async () => {
      await startSend({ selectedQuestions: [Q[0]], formData: FORM, conversationId: null }, { fetch: fetchFn, sleep: async () => {} });
    });
    expect(screen.getByText(/Cererea a fost trimisă/)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(DONE_VISIBLE_MS + 10);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the error with a dismiss button', async () => {
    const fetchFn = vi.fn(async () => json(429, { error: 'Limită zilnică atinsă' })) as unknown as typeof fetch;
    render(<SendQueueBanner />);
    await act(async () => {
      await startSend({ selectedQuestions: Q, formData: FORM, conversationId: null }, { fetch: fetchFn, sleep: async () => {} });
    });
    expect(screen.getByText('Trimiterea a eșuat')).toBeTruthy();
    expect(screen.getByText('Limită zilnică atinsă')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Închide' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('spune ce n-a plecat şi de ce', async () => {
    const form: WizardFormData = {
      solicitantName: 'Ion Popescu', solicitantEmail: 'ion@mail.ro', solicitantAddress: 'Str. Victoriei 10',
      saveAddress: false, institutionName: 'Primăria Pitești', institutionEmail: 'registratura@primaria.ro', sessionName: 'T',
    };
    const questions: QuestionItem[] = ['Unu?', 'Doi?', 'Trei?'].map((text, i) => ({
      id: `q${i}`, category: 'A_FINANCIAR', text, isCustom: true, isEdited: false,
    }));
    let emailCall = 0;
    const fetchFn = vi.fn(async (url: string) =>
      url === '/api/emails/send'
        ? ++emailCall === 2
          ? json(400, { error: 'Fișierul „doc.pdf” nu mai e disponibil. Atașează-l din nou.' })
          : json(200, { success: true })
        : json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] }),
    ) as unknown as typeof fetch;

    render(<SendQueueBanner />);
    await act(async () => {
      await startSend(
        { selectedQuestions: questions, formData: form, conversationId: null },
        { fetch: fetchFn, sleep: async () => {} },
      );
    });
    expect(screen.getByText(/2 din 3/)).toBeTruthy();
    expect(screen.getByText(/nu mai e disponibil/)).toBeTruthy();
  });

  // Cu eşecuri banner-ul rămâne: lista şi butonul de retrimitere nu dispar în timp ce omul citeşte.
  it('cu o cerere refuzată de Resend: rămâne deschis, oferă retrimiterea şi o duce la capăt', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let emailCall = 0;
    const fetchFn = vi.fn(async (url: string) =>
      url === '/api/emails/send'
        ? ++emailCall === 1
          ? json(500, { error: 'Eroare la trimitere: rate limited' })
          : json(200, { success: true })
        : json(200, { requests: [{ id: 'r1' }] }),
    ) as unknown as typeof fetch;
    render(<SendQueueBanner />);
    await act(async () => {
      await startSend({ selectedQuestions: [Q[0]], formData: FORM, conversationId: null }, { fetch: fetchFn, sleep: async () => {} });
    });
    await act(async () => {
      vi.advanceTimersByTime(DONE_VISIBLE_MS + 10);
    });
    const retry = screen.getByRole('button', { name: 'Reîncearcă cererea' });
    await act(async () => {
      fireEvent.click(retry);
      await vi.waitFor(() => expect(getSendQueueState().status).toBe('done'));
    });
    expect(getSendQueueState()).toMatchObject({ sent: 1, failures: [] });
    expect(screen.getByText(/Cererea a fost trimisă/)).toBeTruthy();
  });

  it('nu oferă retrimiterea când cererea poate să fi plecat (504)', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url === '/api/emails/send'
        ? new Response('<html>timeout</html>', { status: 504 })
        : json(200, { requests: [{ id: 'r1' }] }),
    ) as unknown as typeof fetch;
    render(<SendQueueBanner />);
    await act(async () => {
      await startSend({ selectedQuestions: [Q[0]], formData: FORM, conversationId: null }, { fetch: fetchFn, sleep: async () => {} });
    });
    expect(screen.getByText(/verifică în dashboard/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reîncearcă/ })).toBeNull();
  });
});
