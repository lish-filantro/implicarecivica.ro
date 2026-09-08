/**
 * lib/institutii/types — shape contract of the curated institution records.
 * (Types only: the test pins the required fields through `satisfies`.)
 */
import { describe, it, expect } from 'vitest';
import type { Institutie, Domeniu, CazPopular, SearchEntry, NivelCategorie } from '@/lib/institutii/types';

describe('institutii types', () => {
  it('accept the minimal institution record', () => {
    const nivel: NivelCategorie = 'Local';
    const inst = {
      id: 'PRIMARIE_TEMPLATE',
      slug: 'primarie',
      tip_institutie: 'Primărie',
      nivel: 'Local',
      nume_oficial: 'Primăria',
      nume_scurt: 'Primăria',
      aplicabilitate: 'Toate localitățile',
      atributii_principale: [],
      cazuri_utilizare_544: [],
      is_template: true,
      nivel_categorie: nivel,
    } satisfies Institutie;
    const domeniu = { id: 'x', label: 'X', icon: '•', description: '', patterns: ['X'] } satisfies Domeniu;
    const caz = { text: 't', institutieSlug: 'primarie', institutieNume: 'Primăria', domeniuId: 'x' } satisfies CazPopular;
    const entry = { slug: 'primarie', numeScurt: 'p', numeOficial: 'P', haystack: 'p', words: [] } satisfies SearchEntry;
    expect([inst.slug, domeniu.id, caz.domeniuId, entry.slug]).toEqual(['primarie', 'x', 'x', 'primarie']);
  });
});
