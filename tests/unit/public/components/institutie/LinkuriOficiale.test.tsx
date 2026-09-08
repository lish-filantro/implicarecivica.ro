// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LinkuriOficiale, BazaLegala, officialLinks, linkLabels } from '@/components/public/institutie/LinkuriOficiale';
import { getAllInstitutii, type Institutie } from '@/lib/institutii';

afterEach(cleanup);

const base = getAllInstitutii()[0];
const inst: Institutie = {
  ...base,
  link_uri_oficiale: {
    site_principal: 'https://exemplu.ro',
    formulare_544: 'http://exemplu.ro/544',
    nota: 'nu este link',
    ceva_nou: 'https://exemplu.ro/nou',
  },
  legislatie_baza: { document_principal: 'HG 1/2020' },
};

describe('officialLinks', () => {
  it('keeps only http(s) values, in file order', () => {
    expect(officialLinks(inst)).toEqual([
      ['site_principal', 'https://exemplu.ro'],
      ['formulare_544', 'http://exemplu.ro/544'],
      ['ceva_nou', 'https://exemplu.ro/nou'],
    ]);
    expect(officialLinks({ ...inst, link_uri_oficiale: undefined })).toEqual([]);
  });
});

describe('LinkuriOficiale', () => {
  it('renders labelled external links, falling back to the humanised key', () => {
    render(<LinkuriOficiale inst={inst} />);
    const site = screen.getByRole('link', { name: linkLabels.site_principal });
    expect(site.getAttribute('href')).toBe('https://exemplu.ro');
    expect(site.getAttribute('target')).toBe('_blank');
    expect(site.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Formulare 544' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ceva nou' })).toBeTruthy();
    expect(screen.queryByText('nu este link')).toBeNull();
  });

  it('renders nothing without links', () => {
    const { container } = render(<LinkuriOficiale inst={{ ...inst, link_uri_oficiale: {} }} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('BazaLegala', () => {
  it('shows the main legal document, nothing when absent', () => {
    render(<BazaLegala inst={inst} />);
    expect(screen.getByText('Baza legală')).toBeTruthy();
    expect(screen.getByText('HG 1/2020')).toBeTruthy();
    cleanup();
    const none = render(<BazaLegala inst={{ ...inst, legislatie_baza: undefined }} />);
    expect(none.container.innerHTML).toBe('');
  });
});
