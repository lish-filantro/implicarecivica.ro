// @vitest-environment jsdom
/**
 * Navigarea din zona logată. Raportul de testare: „Asistent 544" şi „Trimite Cereri" erau două
 * uşi spre acelaşi lucru, iar cea directă ducea într-un ecran de întrebări gol. Acum e o singură
 * intrare, „Cerere nouă", care deschide ecranul de alegere dintre cele două drumuri.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { TopNavbar } from '@/components/navigation/TopNavbar';

// jsdom nu implementează matchMedia, iar DarkModeToggle îl cere la montare.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  nav.pathname = '/dashboard';
});

const labels = (links: HTMLElement[]) => links.map((l) => l.textContent?.trim());

describe('TopNavbar', () => {
  it('are o singură intrare „Cerere nouă" spre /requests/start, în locul chatului şi al wizard-ului', () => {
    render(<TopNavbar />);
    const link = screen.getByRole('link', { name: 'Cerere nouă' });
    expect(link.getAttribute('href')).toBe('/requests/start');
    expect(screen.queryByRole('link', { name: /Asistent 544/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Trimite Cereri/ })).toBeNull();
  });

  it('păstrează ordinea: Panou, Cerere nouă, Emailuri, Feedback', () => {
    render(<TopNavbar />);
    const links = screen.getAllByRole('link').filter((l) => l.textContent?.trim());
    expect(labels(links)).toEqual(['Panou', 'Cerere nouă', 'Emailuri', 'Feedback']);
  });

  it('meniul mobil are aceleaşi intrări', () => {
    render(<TopNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /Deschide meniul/ }));
    const menus = screen.getAllByRole('navigation');
    const mobile = menus[menus.length - 1];
    const links = within(mobile).getAllByRole('link');
    expect(labels(links)).toEqual(['Panou', 'Cerere nouă', 'Emailuri', 'Feedback']);
    expect(within(mobile).getByRole('link', { name: 'Cerere nouă' }).getAttribute('href')).toBe('/requests/start');
  });

  it.each(['/requests/start', '/requests/new', '/chat', '/chat/abc'])(
    '„Cerere nouă" e marcată activă pe %s (ambele drumuri pornesc de acolo)',
    (pathname) => {
      nav.pathname = pathname;
      render(<TopNavbar />);
      expect(screen.getByRole('link', { name: 'Cerere nouă' }).getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('link', { name: 'Panou' }).getAttribute('aria-current')).toBeNull();
    },
  );

  it('pe panou, doar „Panou" e activă', () => {
    render(<TopNavbar />);
    expect(screen.getByRole('link', { name: 'Panou' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Cerere nouă' }).getAttribute('aria-current')).toBeNull();
  });
});
