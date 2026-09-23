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

describe('Procedura544 — contacte ascunse (starea implicită)', () => {
  /**
   * Datele de contact ale instituţiilor sunt incomplete: din 86 de intrări, 44 sunt şabloane
   * per judeţ/localitate şi niciunul nu are adresă. Până la o listă verificată, cardul nu mai
   * afişează nimic din ce ar putea fi greşit — rămân titlul şi butonul spre aplicaţie.
   */
  it('nu afişează emailul, telefonul, adresa sau departamentul', () => {
    const { container } = render(<Procedura544 inst={inst} />);
    expect(screen.getByText('Trimite o cerere 544')).toBeTruthy();
    expect(container.textContent).not.toContain('cereri@exemplu.ro');
    expect(container.textContent).not.toContain('111-2222');
    expect(container.textContent).not.toContain('Str. Exemplu 1');
    expect(container.textContent).not.toContain('Biroul de presă');
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('duce butonul la alegerea de la începutul unei cereri noi', () => {
    render(<Procedura544 inst={inst} />);
    expect(screen.getByRole('link', { name: /trimite o cerere/i }).getAttribute('href')).toBe(
      '/requests/start',
    );
  });
});

describe('Procedura544 — contacte afişate (la reactivare)', () => {
  it('renders department, the tel link (digits only), address and the CTA', () => {
    render(<Procedura544 inst={inst} afiseazaContacte />);
    expect(screen.getByText('Biroul de presă')).toBeTruthy();
    expect(screen.getByRole('link', { name: '+40 (21) 111-2222' }).getAttribute('href')).toBe('tel:+40211112222');
    expect(screen.getByText('Str. Exemplu 1')).toBeTruthy();
  });

  /**
   * Raportul de testare: apăsarea pe „Trimite o cerere" deschidea clientul de email. Cauza era
   * adresa instituţiei, randată ca `mailto:` imediat deasupra butonului — un click alăturat.
   */
  it('nu randează adresa instituţiei ca link mailto', () => {
    const { container } = render(<Procedura544 inst={inst} afiseazaContacte />);
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.getByText('cereri@exemplu.ro')).toBeTruthy();
  });

  it('omits the optional rows when no contact data exists', () => {
    render(<Procedura544 inst={{ ...inst, sediu: undefined, procedura_544: undefined }} afiseazaContacte />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText(/Departament responsabil/)).toBeNull();
  });
});
