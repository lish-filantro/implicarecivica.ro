// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InstitutiiRelated, institutiiSimilare } from '@/components/public/institutie/InstitutiiRelated';
import { getAllInstitutii, getDomeniuForInstitutie, getInstitutiiByDomeniu } from '@/lib/institutii';

afterEach(cleanup);

const all = getAllInstitutii();
const inst = all.find((i) => {
  const d = getDomeniuForInstitutie(i);
  return d && getInstitutiiByDomeniu(d.id).filter((x) => !x.is_template && x.id !== i.id).length >= 2;
})!;
const domeniu = getDomeniuForInstitutie(inst)!;

describe('institutiiSimilare', () => {
  it('returns up to 4 non-template institutions of the domain, excluding the current one', () => {
    const similare = institutiiSimilare(inst, domeniu);
    expect(similare.length).toBeGreaterThanOrEqual(2);
    expect(similare.length).toBeLessThanOrEqual(4);
    expect(similare.every((s) => !s.is_template && s.id !== inst.id)).toBe(true);
    expect(institutiiSimilare(inst, undefined)).toEqual([]);
  });
});

describe('InstitutiiRelated', () => {
  it('renders a link card per related institution with the use-case count', () => {
    const similare = institutiiSimilare(inst, domeniu);
    render(<InstitutiiRelated similare={similare} domeniu={domeniu} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      `${domeniu.icon} Alte instituții din domeniul ${domeniu.label}`,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(similare.map((s) => `/institutii/${s.slug}`));
    expect(links[0].textContent).toContain(`${similare[0].cazuri_utilizare_544.length} cereri posibile`);
  });

  it('renders nothing without related institutions', () => {
    const { container } = render(<InstitutiiRelated similare={[]} domeniu={domeniu} />);
    expect(container.innerHTML).toBe('');
  });
});
