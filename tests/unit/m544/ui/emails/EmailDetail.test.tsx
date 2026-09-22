// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import EmailDetail, { EmailEmptyState, canReclassify } from '@m544/ui/emails/EmailDetail';
import type { ReviewPost } from '@m544/ui/emails/review/useReview';
import type { AssignableRequest } from '@m544/requests/queries.client';
import { makeEmail } from './_fixtures';

afterEach(cleanup);

const assignable: AssignableRequest[] = [
  {
    id: 'r1',
    subject: 'Buget 2026',
    institution_name: 'Primăria Cluj',
    institution_email: 'registratura@primarie.ro',
    status: 'pending',
    registration_number: '4521',
    deadline_date: null,
    extension_date: null,
    session_id: 's1',
    session_label: 'Buget 2026',
  },
];
const noRequests = async () => [];
const PANEL = 'Atribuire manuală';
const OPEN_ASSIGN = 'Atribuie unei cereri';

describe('EmailDetail', () => {
  it('renders a received email with category badge, registration number and attachment button', () => {
    const email = makeEmail({
      subject: 'Raspuns la cererea 12',
      category: 'raspunse',
      registration_number: '4521',
      body: '<p>Text raspuns</p><script>alert(1)</script>',
      attachments: [{ name: 'raspuns.pdf', type: 'application/pdf', size: 2048 }],
    });
    const { container } = render(<EmailDetail email={email} loadRequests={noRequests} />);

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
    // the panel stays folded away until asked for; reclassify available on completed received emails
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(screen.getByRole('button', { name: OPEN_ASSIGN })).toBeTruthy();
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
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(screen.queryByRole('button', { name: OPEN_ASSIGN })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clasificarea e greșită' })).toBeNull();
  });

  it('any received email can be assigned on demand, however the classifier labelled it', async () => {
    const email = makeEmail({ id: 'e1', category: 'irelevant' });
    const post = vi.fn<ReviewPost>(async () => ({ ...email, request_id: 'r1', category: 'raspunse' }));
    const onUpdated = vi.fn();
    render(<EmailDetail email={email} post={post} onUpdated={onUpdated} loadRequests={async () => assignable} />);

    fireEvent.click(screen.getByRole('button', { name: OPEN_ASSIGN }));
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Întrebarea')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Emailul este'), { target: { value: 'raspunse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atribuie' }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('e1', { action: 'assign', request_id: 'r1', category: 'raspunse' });
  });

  it('a flagged email opens with the panel already unfolded and assigns via the injected post', async () => {
    const email = makeEmail({ id: 'e1', needs_review: true, category: 'raspunse' });
    const refreshed = { ...email, needs_review: false, request_id: 'r1' };
    const post = vi.fn<ReviewPost>(async () => refreshed);
    const onUpdated = vi.fn();
    render(<EmailDetail email={email} post={post} onUpdated={onUpdated} loadRequests={async () => assignable} />);

    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(screen.queryByRole('button', { name: OPEN_ASSIGN })).toBeNull();
    await waitFor(() => expect(screen.getByText(/nr\. 4521/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Atribuie' }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(refreshed));
    expect(post).toHaveBeenCalledWith('e1', { action: 'assign', request_id: 'r1', category: 'raspunse' });
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
