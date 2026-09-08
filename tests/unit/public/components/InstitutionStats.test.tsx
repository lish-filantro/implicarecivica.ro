// @vitest-environment jsdom
/**
 * components/public/InstitutionStats — runtime fetch of the open-data card.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { InstitutionStats, INSUFFICIENT_TEXT, STATS_TITLE, statsUrl } from '@/components/public/InstitutionStats';

afterEach(cleanup);

function fetcher(status: number, body: unknown) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const full = {
  total: 12,
  insufficient: false,
  answered: 9,
  delayed: 2,
  extension: 1,
  pending: 0,
  median_days_to_answer: 8,
  answered_within_deadline_pct: 67,
};

describe('InstitutionStats', () => {
  it('builds the API URL from nume and slug', () => {
    expect(statsUrl('Primăria Pitești', 'primarie')).toBe(
      '/api/public/institutii-stats?nume=Prim%C4%83ria+Pite%C8%99ti&slug=primarie',
    );
  });

  it('renders nothing while loading and calls the API once', () => {
    const { fn, calls } = fetcher(200, full);
    const { container } = render(<InstitutionStats nume="ANAF" slug="anaf" fetcher={fn} />);
    expect(container.innerHTML).toBe('');
    expect(calls).toEqual(['/api/public/institutii-stats?nume=ANAF&slug=anaf']);
  });

  it('renders the card with the five figures', async () => {
    const { fn } = fetcher(200, full);
    render(<InstitutionStats nume="ANAF" slug="anaf" fetcher={fn} />);
    await waitFor(() => expect(screen.getByText(STATS_TITLE)).toBeTruthy());
    expect(screen.getByText('Cereri trimise').nextElementSibling?.textContent).toBe('12');
    expect(screen.getByText('Răspunsuri').nextElementSibling?.textContent).toBe('9');
    expect(screen.getByText('Întârziate').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Mediană zile până la răspuns').nextElementSibling?.textContent).toBe('8');
    expect(screen.getByText('Răspunsuri în termen').nextElementSibling?.textContent).toBe('67%');
  });

  it('shows a dash for null median / pct', async () => {
    const { fn } = fetcher(200, { ...full, median_days_to_answer: null, answered_within_deadline_pct: null });
    render(<InstitutionStats nume="ANAF" slug="anaf" fetcher={fn} />);
    await waitFor(() => expect(screen.getByText(STATS_TITLE)).toBeTruthy());
    expect(screen.getByText('Mediană zile până la răspuns').nextElementSibling?.textContent).toBe('–');
    expect(screen.getByText('Răspunsuri în termen').nextElementSibling?.textContent).toBe('–');
  });

  it('shows the muted line when the sample is insufficient', async () => {
    const { fn } = fetcher(200, { total: 2, insufficient: true });
    render(<InstitutionStats nume="ANAF" slug="anaf" fetcher={fn} />);
    await waitFor(() => expect(screen.getByText(INSUFFICIENT_TEXT)).toBeTruthy());
    expect(screen.queryByText(STATS_TITLE)).toBeNull();
  });

  it('renders nothing on HTTP errors or network failures', async () => {
    const { fn } = fetcher(500, { error: 'x' });
    const a = render(<InstitutionStats nume="ANAF" slug="anaf" fetcher={fn} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(a.container.innerHTML).toBe('');
    cleanup();

    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const b = render(<InstitutionStats nume="ANAF" slug="anaf" fetcher={failing} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(b.container.innerHTML).toBe('');
  });
});
