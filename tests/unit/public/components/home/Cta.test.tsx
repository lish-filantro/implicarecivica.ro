// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Cta } from '@/components/public/home/Cta';

afterEach(cleanup);

describe('Cta', () => {
  it('renders the closing pitch with a register link', () => {
    render(<Cta />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('E gratuit. E simplu. E dreptul tău.');
    expect(screen.getByRole('link', { name: 'Începe acum' }).getAttribute('href')).toBe('/register');
  });
});
