// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHeader } from '@m544/ui/dashboard/DashboardHeader';
import { DashboardAlerts } from '@m544/ui/dashboard/DashboardAlerts';
import { KPICard } from '@m544/ui/dashboard/KPICard';
import { KpiGrid } from '@m544/ui/dashboard/KpiGrid';
import { buildStatCards } from '@m544/ui/dashboard/kpi-cards';
import { SessionFilters } from '@m544/ui/dashboard/SessionFilters';
import { SessionList } from '@m544/ui/dashboard/SessionList';
import { computeSessionStats } from '@m544/requests/utils/session-stats';
import type { DashboardStats } from '@m544/shared/types/request';
import { makeSession } from './_fixtures';

const stats: DashboardStats = {
  total: 12,
  this_month: 3,
  registered: 4,
  waiting: 1,
  by_status: { pending: 2, received: 4, extension: 1, answered: 3, delayed: 2 },
};

describe('DashboardHeader', () => {
  it('greets the user and shows the unread badge only when needed', () => {
    const { rerender } = render(<DashboardHeader userName="Ana" />);
    expect(screen.getByText('Bine ai revenit, Ana!')).toBeTruthy();
    expect(screen.queryByLabelText(/Notificari/)).toBeNull();

    rerender(<DashboardHeader userName="Ana" unreadNotifications={12} />);
    expect(screen.getByLabelText('Notificari (12 necitite)')).toBeTruthy();
    expect(screen.getByText('9+')).toBeTruthy();
  });
});

describe('DashboardAlerts', () => {
  it('renders nothing without alerts', () => {
    const { container } = render(<DashboardAlerts alerts={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders each alert inside a live region', () => {
    render(
      <DashboardAlerts
        alerts={[
          { type: 'critical', message: '2 cereri cu termen în următoarele 3 zile' },
          { type: 'warning', message: '1 cereri trimise fără număr de înregistrare' },
        ]}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('2 cereri cu termen în următoarele 3 zile')).toBeTruthy();
    expect(screen.getByText('1 cereri trimise fără număr de înregistrare')).toBeTruthy();
  });
});

describe('KPICard', () => {
  const base = buildStatCards(stats, 0)[0];

  it('renders title, value and subtitle', () => {
    render(<KPICard {...base} />);
    expect(screen.getByText('Total cereri')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Luna aceasta: 3')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('becomes a keyboard-operable button when clickable', () => {
    const onClick = vi.fn();
    render(<KPICard {...base} onClick={onClick} />);
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('KpiGrid', () => {
  it('renders the six cards and the critical subtitle', () => {
    render(<KpiGrid requestStats={stats} criticalCount={2} />);
    for (const title of ['Total cereri', 'Așteptare înregistrare', 'Înregistrate', 'Răspunse', 'Prelungite', 'Întârziate']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getByText('2 termene în următoarele 3 zile')).toBeTruthy();
  });

  it('falls back to the overdue subtitle without critical requests', () => {
    render(<KpiGrid requestStats={stats} criticalCount={0} />);
    expect(screen.getByText('Termene depășite fără răspuns')).toBeTruthy();
  });
});

describe('SessionFilters', () => {
  const sessions = [
    makeSession({ cached_status: 'pending' }),
    makeSession({ cached_status: 'completed' }),
    makeSession({ cached_status: 'completed' }),
  ];
  const sessionStats = computeSessionStats(sessions);

  it('shows only the buckets with sessions and reports clicks', () => {
    const onChange = vi.fn();
    render(
      <SessionFilters sessionCount={3} sessionStats={sessionStats} statusFilter="all" onChange={onChange} />,
    );
    expect(screen.getByText('Toate (3)')).toBeTruthy();
    expect(screen.getByText('În așteptare (1)')).toBeTruthy();
    expect(screen.getByText('Finalizate (2)')).toBeTruthy();
    expect(screen.queryByText(/Întârziate/)).toBeNull();

    fireEvent.click(screen.getByText('Finalizate (2)'));
    expect(onChange).toHaveBeenCalledWith('completed');
  });

  it('renders nothing without sessions', () => {
    const { container } = render(
      <SessionFilters sessionCount={0} sessionStats={computeSessionStats([])} statusFilter="all" onChange={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('SessionList', () => {
  const sessions = [
    makeSession({ id: 'a', institution_name: 'Primăria Cluj', cached_status: 'pending' }),
    makeSession({ id: 'b', institution_name: 'Consiliul Județean Iași', cached_status: 'completed' }),
  ];
  const sessionStats = computeSessionStats(sessions);

  it('renders the header counts and one card per filtered session', () => {
    const onOpenDetail = vi.fn();
    render(
      <SessionList
        sessions={sessions}
        filteredSessions={[sessions[1]]}
        sessionStats={sessionStats}
        statusFilter="completed"
        onFilterChange={() => {}}
        onOpenDetail={onOpenDetail}
      />,
    );
    expect(screen.getByText('Sesiunile tale de cereri')).toBeTruthy();
    expect(screen.getByText(/2 sesiuni · 2 cereri trimise/)).toBeTruthy();
    expect(screen.getByText('Consiliul Județean Iași')).toBeTruthy();
    expect(screen.queryByText('Primăria Cluj')).toBeNull();
  });

  it('shows the first-request empty state for the "all" filter', () => {
    render(
      <SessionList
        sessions={[]}
        filteredSessions={[]}
        sessionStats={computeSessionStats([])}
        statusFilter="all"
        onFilterChange={() => {}}
        onOpenDetail={() => {}}
      />,
    );
    expect(screen.getByText('Nu există cereri încă')).toBeTruthy();
    expect(screen.getByText('Creează Cerere')).toBeTruthy();
  });

  it('shows the filter-specific empty state otherwise', () => {
    render(
      <SessionList
        sessions={sessions}
        filteredSessions={[]}
        sessionStats={sessionStats}
        statusFilter="overdue"
        onFilterChange={() => {}}
        onOpenDetail={() => {}}
      />,
    );
    expect(screen.getByText('Nu există sesiuni cu acest status')).toBeTruthy();
    expect(screen.queryByText('Creează Cerere')).toBeNull();
  });
});
