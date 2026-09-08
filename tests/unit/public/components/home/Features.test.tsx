// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Features, FEATURES } from '@/components/public/home/Features';

afterEach(cleanup);

describe('Features', () => {
  it('renders the "de ce local" anchor section and the four feature cards', () => {
    const { container } = render(<Features />);
    expect(container.querySelector('section#de-ce-local')).toBeTruthy();
    expect(screen.getByText('De ce începem local')).toBeTruthy();
    expect(screen.getByText('Ce construim')).toBeTruthy();
    expect(FEATURES).toHaveLength(4);
    for (const f of FEATURES) {
      expect(screen.getByText(f.titlu)).toBeTruthy();
      expect(screen.getByText(f.desc)).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: /Citește mai mult despre proiect/ }).getAttribute('href')).toBe('/despre');
  });
});
