// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Procedura544, contactCereri } from '@/components/public/institutie/Procedura544';
import { getAllInstitutii, type Institutie } from '@/lib/institutii';

afterEach(cleanup);

const base = getAllInstitutii()[0];
const inst: Institutie = {
  ...base,
  sediu: { adresa: 'Str. Exemplu 1', telefon: '021 000 0000', email: 'sediu@exemplu.ro' },
  procedura_544: {
    contact_cereri: 'cereri@exemplu.ro',
    telefon_cereri: '+40 (21) 111-2222',
    departament_responsabil: 'Biroul de presă',
  },
};

describe('contactCereri', () => {
  it('prefers the procedura_544 contacts and falls back to sediu', () => {
    expect(contactCereri(inst)).toEqual({
      departament: 'Biroul de presă',
      email: 'cereri@exemplu.ro',
      telefon: '+40 (21) 111-2222',
      adresa: 'Str. Exemplu 1',
    });
    expect(contactCereri({ ...inst, procedura_544: undefined })).toMatchObject({
      email: 'sediu@exemplu.ro',
      telefon: '021 000 0000',
      departament: undefined,
    });
  });
});

describe('Procedura544', () => {
  it('renders department, mailto/tel links (digits only), address and the register CTA', () => {
    render(<Procedura544 inst={inst} />);
    expect(screen.getByText('Trimite o cerere 544')).toBeTruthy();
    expect(screen.getByText('Biroul de presă')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'cereri@exemplu.ro' }).getAttribute('href')).toBe('mailto:cereri@exemplu.ro');
    expect(screen.getByRole('link', { name: '+40 (21) 111-2222' }).getAttribute('href')).toBe('tel:+40211112222');
    expect(screen.getByText('Str. Exemplu 1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trimite o cerere' }).getAttribute('href')).toBe('/register');
  });

  it('omits the optional rows when no contact data exists', () => {
    render(<Procedura544 inst={{ ...inst, sediu: undefined, procedura_544: undefined }} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText(/Departament responsabil/)).toBeNull();
  });
});
