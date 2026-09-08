// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Hero } from '@/components/public/home/Hero';

afterEach(cleanup);

describe('Hero', () => {
  it('renders the headline, logo, primary CTA and the anchor to the next section', () => {
    const { container } = render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Administrația publică');
    expect(screen.getByAltText('Implicare Civică')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trimite prima cerere' }).getAttribute('href')).toBe('/register');
    expect(screen.getByRole('link', { name: /Află mai multe/ }).getAttribute('href')).toBe('#de-ce-local');
    expect(container.querySelector('style')?.textContent).toContain('@keyframes hero-fade-up');
  });
});
