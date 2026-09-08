// @vitest-environment jsdom
/**
 * app/page.tsx — composition smoke test: navbar, the five sections, footer.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '@/app/page';

describe('Home page', () => {
  it('composes nav, hero, features, how-it-works, institutions teaser, CTA and footer in order', () => {
    const html = renderToStaticMarkup(<Home />);
    const markers = [
      '<nav',
      'Administrația publică',
      'id="de-ce-local"',
      'Ce construim',
      'Cum funcționează',
      'termenul legal de 10 zile lucrătoare',
      'Instituții publice',
      'E gratuit. E simplu. E dreptul tău.',
      '<footer',
    ];
    const positions = markers.map((m) => html.indexOf(m));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
