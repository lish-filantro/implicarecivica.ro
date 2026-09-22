/**
 * Acordul din bannerul de limită zilnică. Acelaşi defect ca în PreviewModal („1 emailuri
 * separate"), semnalat în raportul de testare din 2026-09-22: cu `remaining = 0` şi o singură
 * cerere selectată, textul devenea „Ai selectat 1 cereri, dar mai poţi trimite doar 0".
 */
import { describe, it, expect } from 'vitest';
import { cereriText } from '@m544/ui/requests/preview/RateLimitNotice';

describe('cereriText', () => {
  it('foloseşte singularul pentru una singură', () => {
    expect(cereriText(1)).toBe('1 cerere');
  });

  it('foloseşte pluralul pentru mai multe', () => {
    expect(cereriText(3)).toBe('3 cereri');
  });

  it('foloseşte pluralul pentru zero', () => {
    expect(cereriText(0)).toBe('0 cereri');
  });
});
