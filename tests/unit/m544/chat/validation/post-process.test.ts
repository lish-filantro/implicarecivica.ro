/**
 * chat/validation/post-process — what happens to the model's text after the
 * agentic loop: STEP_2 email confidence warning, leak sanitization, fallback
 * for empty answers, and URL harvesting into the sources list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  postProcessResponse,
  appendEmailWarning,
  extractUrls,
  LOW_CONFIDENCE_WARNING,
} from '@m544/chat/validation/post-process';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('appendEmailWarning', () => {
  it('appends the warning at STEP_2 when the best email has low confidence', () => {
    const text = 'Email: office@primariapitesti.ro';
    expect(appendEmailWarning(text, 'STEP_2', [])).toBe(text + LOW_CONFIDENCE_WARNING);
    expect(LOW_CONFIDENCE_WARNING).toContain('⚠️ **ATENȚIE:**');
  });

  it('does not warn when the best of several emails is not low', () => {
    const text = 'Emailuri: relatii.publice@mai.gov.ro sau altceva@gmail.com — legea 544';
    expect(appendEmailWarning(text, 'STEP_2', ['https://www.mai.gov.ro/'])).toBe(text);
  });

  it('never warns outside STEP_2 or without an email', () => {
    expect(appendEmailWarning('Email: x@gmail.com', 'STEP_1', [])).toBe('Email: x@gmail.com');
    expect(appendEmailWarning('Email: x@gmail.com', 'STEP_3', [])).toBe('Email: x@gmail.com');
    expect(appendEmailWarning('fara email', 'STEP_2', [])).toBe('fara email');
  });
});

describe('extractUrls', () => {
  it('strips trailing punctuation and brackets', () => {
    expect(extractUrls('Vezi https://primariapitesti.ro/contact). si https://www.mai.gov.ro/legea-544, ok')).toEqual([
      'https://primariapitesti.ro/contact',
      'https://www.mai.gov.ro/legea-544',
    ]);
    expect(extractUrls('[link](https://x.ro/a>)')).toEqual(['https://x.ro/a']);
  });
});

describe('postProcessResponse', () => {
  it('sanitizes a system prompt leak', () => {
    const r = postProcessResponse({ text: 'Iată REGULĂ_AUR: nu avansa fără confirmare.', sources: [], webSearchQueries: [] }, 'STEP_1');
    expect(r.text).toBe('Iată [...]: nu avansa fără confirmare.');
    expect(console.error).toHaveBeenCalledWith('SYSTEM PROMPT LEAK DETECTED');
  });

  it('replaces an (almost) empty answer with the step fallback', () => {
    const r = postProcessResponse({ text: '', sources: [], webSearchQueries: [] }, 'STEP_2');
    expect(r.text).toContain('identificarea instituției');
  });

  it('adds URLs from the text to the sources without duplicating known ones', () => {
    const r = postProcessResponse(
      {
        text: 'Surse: https://www.mai.gov.ro/legea-544 și https://primariapitesti.ro/contact.',
        sources: [{ url: 'https://www.mai.gov.ro/legea-544', title: 'MAI' }],
        webSearchQueries: [],
      },
      'STEP_2',
    );
    expect(r.sources).toEqual([
      { url: 'https://www.mai.gov.ro/legea-544', title: 'MAI' },
      { url: 'https://primariapitesti.ro/contact', title: 'Sursa' },
    ]);
  });

  it('warns then validates, in that order (warning text is kept)', () => {
    const r = postProcessResponse({ text: 'Email: office@primariapitesti.ro', sources: [], webSearchQueries: [] }, 'STEP_2');
    expect(r.text.endsWith(LOW_CONFIDENCE_WARNING)).toBe(true);
  });
});

describe('postProcessResponse → institution', () => {
  const marker = '🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Municipiului Pitești\n📧 registratura@primariapitesti.ro — legea 544\n🔗 https://www.primariapitesti.ro/legea-544';

  it('reads the institution at STEP_2, with the source harvested from the text', () => {
    const r = postProcessResponse({ text: marker, sources: [], webSearchQueries: [] }, 'STEP_2');
    expect(r.institution).toEqual({
      name: 'Primăria Municipiului Pitești',
      email: 'registratura@primariapitesti.ro',
      confidence: 'high',
      sourceUrl: 'https://www.primariapitesti.ro/legea-544',
    });
  });

  it('also reads a re-identification at STEP_3', () => {
    const r = postProcessResponse({ text: marker, sources: [], webSearchQueries: [] }, 'STEP_3');
    expect(r.institution?.name).toBe('Primăria Municipiului Pitești');
  });

  it('is null at STEP_1 and when the answer has no marker', () => {
    expect(postProcessResponse({ text: marker, sources: [], webSearchQueries: [] }, 'STEP_1').institution).toBeNull();
    expect(postProcessResponse({ text: 'Unde este problema?', sources: [], webSearchQueries: [] }, 'STEP_2').institution).toBeNull();
  });
});
