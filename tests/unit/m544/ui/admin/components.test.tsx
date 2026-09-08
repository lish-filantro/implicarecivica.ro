// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminKpiCard } from '@m544/ui/admin/AdminKpiCard';
import { ActivityRow } from '@m544/ui/admin/ActivityRow';
import { StatusRow } from '@m544/ui/admin/StatusRow';
import { StatusDistribution } from '@m544/ui/admin/StatusDistribution';
import { SignupsChart } from '@m544/ui/admin/SignupsChart';
import { TopInstitutions } from '@m544/ui/admin/TopInstitutions';
import { PendingUsersTable } from '@m544/ui/admin/PendingUsersTable';
import { fakeFetch, jsonResponse, pendingFixture, statsFixture } from './_fixtures';

describe('AdminKpiCard / ActivityRow / StatusRow', () => {
  it('formats numbers in Romanian locale', () => {
    render(<AdminKpiCard title="Total conturi" value={1234} color="sky" />);
    expect(screen.getByText('Total conturi')).toBeTruthy();
    expect(screen.getByText((1234).toLocaleString('ro-RO'))).toBeTruthy();
  });

  it('falls back to the sky palette for unknown colours', () => {
    const { container } = render(<AdminKpiCard title="X" value={1} color="magenta" />);
    expect(container.firstElementChild?.className).toContain('border-sky-200');
  });

  it('renders an activity row', () => {
    render(<ActivityRow label="Cereri create" value={50} />);
    expect(screen.getByText('Cereri create')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('sizes the status bar by share of total', () => {
    const { container } = render(<StatusRow label="Răspunse" count={1} total={4} />);
    const bar = container.querySelector('.bg-sky-500') as HTMLElement;
    expect(bar.style.width).toBe('25%');
    expect(screen.getByText('1')).toBeTruthy();
  });
});

describe('StatusDistribution', () => {
  it('maps status keys to labels', () => {
    render(<StatusDistribution title="Distribuție cereri" distribution={statsFixture.requestStatus} emptyLabel="Nicio cerere" />);
    expect(screen.getByText('Distribuție cereri')).toBeTruthy();
    expect(screen.getByText('În așteptare')).toBeTruthy();
    expect(screen.getByText('Răspunse')).toBeTruthy();
    expect(screen.queryByText('Nicio cerere')).toBeNull();
  });

  it('shows the empty label and keeps unknown keys verbatim', () => {
    render(<StatusDistribution title="Distribuție feedback" distribution={{}} emptyLabel="Niciun feedback" />);
    expect(screen.getByText('Niciun feedback')).toBeTruthy();

    render(<StatusDistribution title="X" distribution={{ weird: 2 }} emptyLabel="-" />);
    expect(screen.getByText('weird')).toBeTruthy();
  });
});

describe('SignupsChart', () => {
  it('renders a bar and tooltip per day plus the range labels', () => {
    const { container } = render(<SignupsChart dailySignups={statsFixture.dailySignups} />);
    expect(screen.getByText('Conturi noi pe zi (ultimele 30 zile)')).toBeTruthy();
    expect(screen.getByText('03-02: 3')).toBeTruthy();
    expect(screen.getByText('03-03: 6')).toBeTruthy();
    // first/last labels
    expect(screen.getAllByText('03-01')).toHaveLength(1);
    expect(screen.getAllByText('03-03')).toHaveLength(1);
    const bars = container.querySelectorAll('.bg-sky-500');
    expect(bars).toHaveLength(3);
    expect((bars[2] as HTMLElement).style.height).toBe('100%');
    expect((bars[0] as HTMLElement).style.height).toBe('0%');
  });
});

describe('TopInstitutions', () => {
  it('renders rows with a colour-coded answer rate', () => {
    render(<TopInstitutions institutions={statsFixture.topInstitutions} />);
    expect(screen.getByText('Primăria Cluj')).toBeTruthy();
    expect(screen.getByText('80%').className).toContain('bg-emerald-100');
    expect(screen.getByText('50%').className).toContain('bg-amber-100');
    expect(screen.getByText('0%').className).toContain('bg-red-100');
  });

  it('shows the empty message', () => {
    render(<TopInstitutions institutions={[]} />);
    expect(screen.getByText('Nicio cerere trimisă')).toBeTruthy();
  });
});

describe('PendingUsersTable', () => {
  it('renders nothing without users', () => {
    const { container } = render(<PendingUsersTable users={[]} onRemoved={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows names, emails and placeholders', () => {
    render(<PendingUsersTable users={pendingFixture} onRemoved={() => {}} />);
    expect(screen.getByText('Conturi în așteptarea aprobării (2)')).toBeTruthy();
    expect(screen.getByText('Ana Pop')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(screen.getByText('ionel')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy(); // missing email
  });

  it('approves through the API and reports the removal', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/admin/users/approve': () => jsonResponse(200, { ok: true }),
    });
    const onRemoved = vi.fn();
    render(<PendingUsersTable users={pendingFixture} onRemoved={onRemoved} fetchFn={fetchFn} />);

    fireEvent.click(screen.getAllByText('Aprobă')[0]);
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('u1'));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/admin/users/approve');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ userId: 'u1' });
  });

  it('does not remove the row when approval fails', async () => {
    const { fetchFn } = fakeFetch({
      '/api/admin/users/approve': () => jsonResponse(500, { error: 'boom' }),
    });
    const onRemoved = vi.fn();
    render(<PendingUsersTable users={pendingFixture} onRemoved={onRemoved} fetchFn={fetchFn} />);

    fireEvent.click(screen.getAllByText('Aprobă')[1]);
    // button shows the busy marker while the call is pending, then recovers
    await waitFor(() => expect(screen.getAllByText('Aprobă')).toHaveLength(2));
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('asks for confirmation before rejecting', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/admin/users/reject': () => jsonResponse(200, { ok: true }),
    });
    const onRemoved = vi.fn();
    const confirmFn = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(
      <PendingUsersTable users={pendingFixture} onRemoved={onRemoved} fetchFn={fetchFn} confirmFn={confirmFn} />,
    );

    fireEvent.click(screen.getAllByText('Respinge')[1]);
    expect(confirmFn).toHaveBeenCalledWith('Ești sigur că vrei să ștergi acest cont? Acțiunea este ireversibilă.');
    expect(calls).toHaveLength(0);
    expect(onRemoved).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('Respinge')[1]);
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith('u2'));
    expect(calls[0].url).toBe('/api/admin/users/reject');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ userId: 'u2' });
  });
});
