// @vitest-environment jsdom
/**
 * Meniul public pe ecran mic. Raportul de testare: fără hamburger, cele cinci linkuri plus
 * butonul de login se înghesuiau pe un rând, spre deosebire de zona logată.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PublicNavbar } from '@/components/shared/PublicNavbar';

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

afterEach(cleanup);

describe('PublicNavbar', () => {
  it('are un buton de meniu, închis iniţial', () => {
    render(<PublicNavbar />);
    const buton = screen.getByRole('button', { name: /meniu/i });
    expect(buton.getAttribute('aria-expanded')).toBe('false');
  });

  it('deschide panoul cu toate linkurile şi cu intrarea în cont', () => {
    render(<PublicNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /meniu/i }));

    const panou = screen.getByRole('navigation', { name: /meniu mobil/i });
    for (const eticheta of ['Instituții', 'Alegeri 2024', 'Quiz', 'Despre', 'Contact']) {
      expect(screen.getAllByRole('link', { name: eticheta }).length).toBeGreaterThan(0);
    }
    expect(panou.textContent).toContain('Intră în cont');
  });

  it('închide panoul la a doua apăsare', () => {
    render(<PublicNavbar />);
    const buton = screen.getByRole('button', { name: /meniu/i });
    fireEvent.click(buton);
    fireEvent.click(buton);
    expect(buton.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('navigation', { name: /meniu mobil/i })).toBeNull();
  });
});
