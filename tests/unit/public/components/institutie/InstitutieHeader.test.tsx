// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InstitutieHeader, nivelColors } from '@/components/public/institutie/InstitutieHeader';
import { getAllInstitutii, getDomeniuForInstitutie } from '@/lib/institutii';

afterEach(cleanup);

const all = getAllInstitutii();
const concrete = all.find((i) => !i.is_template && getDomeniuForInstitutie(i))!;
const template = all.find((i) => i.is_template)!;

describe('InstitutieHeader', () => {
  it('renders breadcrumb with domain, level badge, type and official name', () => {
    const domeniu = getDomeniuForInstitutie(concrete);
    render(<InstitutieHeader inst={concrete} domeniu={domeniu} />);
    expect(screen.getByRole('link', { name: 'Instituții' }).getAttribute('href')).toBe('/institutii');
    expect(screen.getByText(`${domeniu!.icon} ${domeniu!.label}`)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(concrete.nume_oficial);
    const badge = screen.getByText(concrete.nivel_categorie);
    expect(badge.className).toContain(nivelColors[concrete.nivel_categorie]);
    expect(screen.queryByText(/Informații generale valabile/)).toBeNull();
  });

  it('shows the template note and omits the domain crumb when none is given', () => {
    render(<InstitutieHeader inst={template} />);
    expect(screen.getByText(/Informații generale valabile pentru toate instituțiile de tip/)).toBeTruthy();
    expect(screen.getByText(template.tip_institutie.toLowerCase())).toBeTruthy();
    expect(screen.getAllByText('/')).toHaveLength(1);
  });
});
