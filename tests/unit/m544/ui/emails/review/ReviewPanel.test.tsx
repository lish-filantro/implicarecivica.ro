// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ReviewPanel, { REVIEW_BANNER, requestLabel } from '@m544/ui/emails/review/ReviewPanel';
import type { ReviewApi } from '@m544/ui/emails/review/useReview';
import type { OpenRequestOption } from '@m544/requests/queries.client';
import { makeEmail } from '../_fixtures';

afterEach(cleanup);

const options: OpenRequestOption[] = [
  { id: 'r1', subject: 'Buget 2026', institution_name: 'Primăria Cluj', status: 'pending', registration_number: null },
  { id: 'r2', subject: 'Contracte', institution_name: 'CJ Cluj', status: 'received', registration_number: '77' },
];

function api(over: Partial<ReviewApi> = {}): ReviewApi {
  return {
    assign: vi.fn(async () => null),
    reclassify: vi.fn(async () => null),
    dismiss: vi.fn(async () => null),
    busy: false,
    error: null,
    ...over,
  };
}

const email = makeEmail({ id: 'e1', needs_review: true });

describe('ReviewPanel', () => {
  it('shows the banner, loads the open requests and assigns the selected one', async () => {
    const review = api();
    const load = vi.fn(async () => options);
    render(<ReviewPanel email={email} review={review} loadOpenRequests={load} />);

    expect(screen.getByText(REVIEW_BANNER)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('CJ Cluj — Contracte (nr. 77)')).toBeTruthy());
    expect(screen.getByText('Primăria Cluj — Buget 2026')).toBeTruthy();

    const assign = screen.getByRole('button', { name: 'Asociază' }) as HTMLButtonElement;
    expect(assign.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Cererea'), { target: { value: 'r2' } });
    expect(assign.disabled).toBe(false);
    fireEvent.click(assign);
    expect(review.assign).toHaveBeenCalledWith('e1', 'r2');
  });

  it('"Marchează ca revizuit" dismisses without a selection', async () => {
    const review = api();
    render(<ReviewPanel email={email} review={review} loadOpenRequests={async () => []} />);
    await waitFor(() => expect(screen.getByText('Nu ai cereri deschise')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Marchează ca revizuit' }));
    expect(review.dismiss).toHaveBeenCalledWith('e1');
  });

  it('surfaces the hook error and the load error; disables the buttons while busy', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ReviewPanel
        email={email}
        review={api({ busy: true, error: 'Cererea nu a fost găsită' })}
        loadOpenRequests={async () => {
          throw new Error('offline');
        }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Cererea nu a fost găsită');
    expect((screen.getByRole('button', { name: 'Marchează ca revizuit' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    cleanup();

    render(
      <ReviewPanel
        email={email}
        review={api()}
        loadOpenRequests={async () => {
          throw new Error('offline');
        }}
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Nu am putut încărca cererile deschise.'));
    consoleError.mockRestore();
  });

  it('requestLabel joins institution and subject, with the registration number when known', () => {
    expect(requestLabel(options[0])).toBe('Primăria Cluj — Buget 2026');
    expect(requestLabel(options[1])).toBe('CJ Cluj — Contracte (nr. 77)');
  });
});
