// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HowItWorks, STEPS } from '@/components/public/home/HowItWorks';

afterEach(cleanup);

describe('HowItWorks', () => {
  it('renders the three numbered steps', () => {
    render(<HowItWorks />);
    expect(screen.getByText('Cum funcționează')).toBeTruthy();
    expect(STEPS.map((s) => s.step)).toEqual(['1', '2', '3']);
    for (const s of STEPS) {
      expect(screen.getByText(s.title)).toBeTruthy();
      expect(screen.getByText(s.desc)).toBeTruthy();
    }
  });

  it('states the legal deadline in business days (Law 544 art. 7)', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/termenul legal de 10 zile lucrătoare/)).toBeTruthy();
    expect(screen.queryByText(/30 de zile/)).toBeNull();
  });
});
