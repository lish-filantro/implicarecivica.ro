// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import EmailDetail, { EmailEmptyState, canReclassify } from '@m544/ui/emails/EmailDetail';
import type { ReviewPost } from '@m544/ui/emails/review/useReview';
import type { OpenRequestOption } from '@m544/requests/queries.client';
import { makeEmail } from './_fixtures';

afterEach(cleanup);

const openRequests: OpenRequestOption[] = [
  { id: 'r1', subject: 'Buget 2026', institution_name: 'Primăria Cluj', status: 'pending', registration_number: null },
];
const noRequests = async () => [];

describe('EmailDetail', () => {
  it('renders a received email with category badge, registration number and attachment button', () => {
    const email = makeEmail({
      subject: 'Raspuns la cererea 12',
      category: 'raspunse',
      registration_number: '4521',
      body: '<p>Text raspuns</p><script>alert(1)</script>',
      attachments: [{ name: 'raspuns.pdf', type: 'application/pdf', size: 2048 }],
    });
    const { container } = render(<EmailDetail email={email} loadOpenRequests={noRequests} />);

    expect(screen.getByRole('heading', { name: 'Raspuns la cererea 12' })).toBeTruthy();
    expect(screen.getByText('Răspuns final')).toBeTruthy();
    expect(screen.getByText('Nr. 4521')).toBeTruthy();
    expect(screen.getByText('Text raspuns')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Atașamente (1)')).toBeTruthy();
    expect(screen.getByRole('button', { name: /raspuns\.pdf/ })).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
    // completed emails show no processing badge
    expect(screen.queryByText('Neprocesar')).toBeNull();
    // no review panel unless flagged; reclassify available on completed received emails
    expect(screen.queryByRole('region', { name: 'Revizuire manuală' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clasificarea e greșită' })).toBeTruthy();
  });

  it('labels the new categories and shows the processing badge; no reclassify while processing', () => {
    render(<EmailDetail email={makeEmail({ category: 'redirectionat', processing_status: 'failed' })} />);
    expect(screen.getByText('Redirecționat')).toBeTruthy();
    expect(screen.getByText('Procesare eșuată')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clasificarea e greșită' })).toBeNull();
    cleanup();
    render(<EmailDetail email={makeEmail({ category: 'irelevant', processing_status: 'processing' })} />);
    expect(screen.getByText('Irelevant')).toBeTruthy();
    expect(screen.getByText('Se procesează...')).toBeTruthy();
  });

  it('hides badges and review controls for sent emails and shows the empty-body placeholder', () => {
    render(<EmailDetail email={makeEmail({ type: 'sent', category: 'trimise', body: null, needs_review: true })} />);
    expect(screen.queryByText('Trimis')).toBeNull();
    expect(screen.getByText('Fără conținut')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Revizuire manuală' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clasificarea e greșită' })).toBeNull();
  });

  it('flagged email: the review panel assigns via the injected post and reports the refreshed email', async () => {
    const email = makeEmail({ id: 'e1', needs_review: true, category: 'raspunse' });
    const refreshed = { ...email, needs_review: false, request_id: 'r1' };
    const post = vi.fn<ReviewPost>(async () => refreshed);
    const onUpdated = vi.fn();
    render(<EmailDetail email={email} post={post} onUpdated={onUpdated} loadOpenRequests={async () => openRequests} />);

    expect(screen.getByRole('region', { name: 'Revizuire manuală' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Primăria Cluj — Buget 2026')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Cererea'), { target: { value: 'r1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Asociază' }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(refreshed));
    expect(post).toHaveBeenCalledWith('e1', { action: 'assign', request_id: 'r1' });
  });

  it('reclassify from the footer posts the corrected category', async () => {
    const email = makeEmail({ id: 'e1', category: 'raspunse' });
    const post = vi.fn<ReviewPost>(async () => ({ ...email, category: 'irelevant' }));
    const onUpdated = vi.fn();
    render(<EmailDetail email={email} post={post} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clasificarea e greșită' }));
    fireEvent.click(screen.getByRole('button', { name: 'Irelevant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trimite corecția' }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ ...email, category: 'irelevant' }));
    expect(post).toHaveBeenCalledWith('e1', { action: 'reclassify', category: 'irelevant' });
  });

  it('canReclassify: received + completed only', () => {
    expect(canReclassify(makeEmail())).toBe(true);
    expect(canReclassify(makeEmail({ processing_status: 'pending' }))).toBe(false);
    expect(canReclassify(makeEmail({ type: 'sent' }))).toBe(false);
  });

  it('EmailEmptyState renders the prompt', () => {
    render(<EmailEmptyState />);
    expect(screen.getByText('Selectează un email')).toBeTruthy();
  });
});
