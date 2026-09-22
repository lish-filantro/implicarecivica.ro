// @vitest-environment jsdom
/**
 * Ecranul „Cerere nouă" (/requests/start). Raportul de testare: intrat direct în wizard, omul
 * dădea de categoriile A–E goale (0/0). Acum alege întâi drumul: ştie deja instituţia şi
 * întrebările (wizard-ul manual) sau are nevoie de ajutor (asistentul din chat).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StartChoice } from '@m544/ui/requests/start/StartChoice';

afterEach(cleanup);

describe('StartChoice', () => {
  it('drumul manual duce în wizard', () => {
    render(<StartChoice />);
    const card = screen.getByRole('link', { name: /Știu instituția și întrebările/ });
    expect(card.getAttribute('href')).toBe('/requests/new');
  });

  it('drumul cu ajutor duce la asistent', () => {
    render(<StartChoice />);
    const card = screen.getByRole('link', { name: /Am nevoie de ajutor/ });
    expect(card.getAttribute('href')).toBe('/chat');
  });

  it('manualul e primul, ajutorul al doilea, iar conversațiile existente rămân accesibile sub ele', () => {
    render(<StartChoice />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toContain('Știu instituția și întrebările');
    expect(links[1].textContent).toContain('Am nevoie de ajutor');
    expect(links[2].textContent).toMatch(/sau continuă o conversație existentă/);
    expect(links[2].getAttribute('href')).toBe('/chat');
  });

  it('are un titlu de pagină', () => {
    render(<StartChoice />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Cerere nouă');
  });
});
