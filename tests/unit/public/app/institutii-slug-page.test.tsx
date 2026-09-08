// @vitest-environment jsdom
/**
 * app/institutii/[slug]/page.tsx — static params, metadata and composition smoke test
 * (the page is an async server component: awaited, then rendered to static markup).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InstitutieDetailPage, { generateStaticParams, generateMetadata } from '@/app/institutii/[slug]/page';
import { getAllInstitutii, getDomeniuForInstitutie } from '@/lib/institutii';

const all = getAllInstitutii();
const inst = all.find((i) => !i.is_template && getDomeniuForInstitutie(i) && i.cazuri_utilizare_544.length > 0)!;

describe('institution page', () => {
  it('generates one static param per institution', () => {
    expect(generateStaticParams()).toEqual(all.map((i) => ({ slug: i.slug })));
  });

  it('builds metadata from the institution, with a not-found fallback', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ slug: inst.slug }) });
    expect(meta.title).toBe(`${inst.nume_scurt} | Implicare Civică`);
    expect(String(meta.description)).toContain(inst.nume_oficial);
    const missing = await generateMetadata({ params: Promise.resolve({ slug: 'nu-exista' }) });
    expect(missing.title).toBe('Instituție negăsită | Implicare Civică');
  });

  it('renders header, use cases, sidebar contact card and related institutions for every institution', async () => {
    for (const i of all) {
      const html = renderToStaticMarkup(await InstitutieDetailPage({ params: Promise.resolve({ slug: i.slug }) }));
      expect(html).toContain(`<h1 class="text-2xl md:text-3xl font-bold`);
      expect(html).toContain('Trimite o cerere 544');
      expect(html).toContain('<footer');
    }
    const html = renderToStaticMarkup(await InstitutieDetailPage({ params: Promise.resolve({ slug: inst.slug }) }));
    expect(html).toContain(`Ce poți cere de la ${inst.nume_scurt}`);
    expect(html).toContain('Alte instituții din domeniul');
  });
});
