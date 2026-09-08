// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionInfoCard } from '@m544/ui/requests/add/SessionInfoCard';
import { RateLimitInfo } from '@m544/ui/requests/add/RateLimitInfo';

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
