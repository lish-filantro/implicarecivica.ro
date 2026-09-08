// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Atributii, Contestatii } from '@/components/public/institutie/Atributii';
import { getAllInstitutii } from '@/lib/institutii';

afterEach(cleanup);

const all = getAllInstitutii();
const inst = all.find((i) => i.atributii_principale.length >= 2)!;
const withContestatii = all.find((i) => i.procedura_544?.contestatii)!;

describe('Atributii', () => {
  it('lists every attribution when there is more than one', () => {
    render(<Atributii inst={inst} />);
    expect(screen.getByText('Ce face această instituție')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(inst.atributii_principale.length);
  });

  it('renders nothing for zero or one attribution (the header already shows the first)', () => {
    const one = render(<Atributii inst={{ ...inst, atributii_principale: ['x'] }} />);
    expect(one.container.innerHTML).toBe('');
  });
});

describe('Contestatii', () => {
  it('renders the complaint path when present, nothing otherwise', () => {
    render(<Contestatii inst={withContestatii} />);
    expect(screen.getByText('Dacă nu primești răspuns')).toBeTruthy();
    expect(screen.getByText(withContestatii.procedura_544!.contestatii!)).toBeTruthy();
    cleanup();
    const none = render(<Contestatii inst={{ ...withContestatii, procedura_544: undefined }} />);
    expect(none.container.innerHTML).toBe('');
  });
});
