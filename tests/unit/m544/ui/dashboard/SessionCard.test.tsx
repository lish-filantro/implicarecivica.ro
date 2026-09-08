// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionCard } from '@m544/ui/dashboard/SessionCard';
import { RequestRow } from '@m544/ui/dashboard/RequestRow';
import { SessionRequestItem } from '@m544/ui/dashboard/SessionRequestItem';
import { SessionDetailModal } from '@m544/ui/dashboard/SessionDetailModal';
import { daysFromNow, makeRequest, makeSession } from './_fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard',
}));

// Relative to the real clock: the components use the one-argument deadline helpers.
const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

describe('SessionCard', () => {
  it('renders institution, status and subject and opens the detail on click', () => {
    const onOpenDetail = vi.fn();
    const session = makeSession({ subject: 'Buget local 2025', cached_status: 'in_progress' });
    render(<SessionCard session={session} onOpenDetail={onOpenDetail} />);

    expect(screen.getByText('Primăria Cluj')).toBeTruthy();
    expect(screen.getByText('În curs')).toBeTruthy();
    fireEvent.click(screen.getByText('Buget local 2025'));
    expect(onOpenDetail).toHaveBeenCalledWith(session);
    // single-request session: no expand toggle
    expect(screen.queryByLabelText('Expandează')).toBeNull();
  });

  it('toggles the request list for multi-request sessions', () => {
    const requests = [
      makeRequest({ request_body: 'Care este bugetul pe 2024?' }),
      makeRequest({ request_body: 'Câți angajați aveți?', status: 'answered' }),
    ];
    render(<SessionCard session={makeSession({ requests })} />);

    expect(screen.getByText(/2 cereri/)).toBeTruthy();
    expect(screen.queryByText('Care este bugetul pe 2024?')).toBeNull();

    fireEvent.click(screen.getByLabelText('Expandează'));
    expect(screen.getByText('Care este bugetul pe 2024?')).toBeTruthy();
    expect(screen.getByText('Câți angajați aveți?')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Restrânge'));
    expect(screen.queryByText('Care este bugetul pe 2024?')).toBeNull();
  });

  it('shows the completed label instead of a deadline', () => {
    render(<SessionCard session={makeSession({ cached_status: 'completed', nearest_deadline: inDays(5) })} />);
    expect(screen.getAllByText('Finalizată')).toHaveLength(2); // status badge + deadline slot
    expect(screen.queryByText(/z rămase/)).toBeNull();
  });
});

describe('RequestRow', () => {
  it('marks overdue requests', () => {
    render(<RequestRow request={makeRequest({ status: 'received', deadline_date: inDays(-4) })} />);
    expect(screen.getByText('Întârziată')).toBeTruthy();
    expect(screen.getByText('4z întârziere')).toBeTruthy();
  });

  it('shows the status label and remaining days otherwise', () => {
    render(<RequestRow request={makeRequest({ status: 'received', deadline_date: inDays(10) })} />);
    expect(screen.getByText('Înregistrată')).toBeTruthy();
    expect(screen.getByText('10z rămase')).toBeTruthy();
  });
});

describe('SessionRequestItem', () => {
  it('renders the answer summary for answered requests', () => {
    const request = makeRequest({
      status: 'answered',
      registration_number: '42/2026',
      answer_summary: { type: 'text', content: 'Bugetul este 10 lei.' },
      response_received_date: daysFromNow(-1),
    });
    render(<SessionRequestItem request={request} index={0} />);
    expect(screen.getByText('Răspuns primit')).toBeTruthy();
    expect(screen.getByText('Nr. 42/2026')).toBeTruthy();
    expect(screen.getByText('Bugetul este 10 lei.')).toBeTruthy();
  });

  it('renders the waiting hint for unregistered requests', () => {
    render(<SessionRequestItem request={makeRequest({ status: 'pending', deadline_date: inDays(15) })} index={2} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('În așteptarea confirmării de înregistrare')).toBeTruthy();
    expect(screen.getByText('15 zile rămase')).toBeTruthy();
  });
});

describe('SessionDetailModal', () => {
  it('renders header, requests and closes on Escape and on the close button', () => {
    const onClose = vi.fn();
    const session = makeSession({
      name: 'Transparență buget',
      institution_email: 'primaria@cluj.ro',
      requests: [makeRequest({ request_body: 'Care este bugetul pe 2024?' })],
    });
    render(<SessionDetailModal session={session} onClose={onClose} />);

    expect(screen.getByText('Transparență buget')).toBeTruthy();
    expect(screen.getByText('· primaria@cluj.ro')).toBeTruthy();
    expect(screen.getByText('Care este bugetul pe 2024?')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Închide'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('navigates to the add-requests page from the footer', () => {
    const onClose = vi.fn();
    const session = makeSession({ id: 'sess-x' });
    render(<SessionDetailModal session={session} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Trimite alte cereri către/));
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/requests/add?session=sess-x');
  });

  it('shows the empty message when the session has no requests', () => {
    render(<SessionDetailModal session={makeSession({ requests: [] })} onClose={() => {}} />);
    expect(screen.getByText('Nu există cereri în această sesiune')).toBeTruthy();
  });
});
