/**
 * chat/anthropic/parse — text, web citations, server-side search queries and
 * web search result URLs out of a Messages API response.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAnthropicResponse, webSearchCount } from '@m544/chat/anthropic/parse';
import {
  message,
  textBlock,
  webCitation,
  charCitation,
  serverToolUse,
  webSearchResults,
  webSearchError,
  toolUse,
  step2Answer,
  usage,
} from '../../../../fixtures/chat/anthropic-blocks';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('parseAnthropicResponse', () => {
  it('joins text blocks with newlines', () => {
    const r = parseAnthropicResponse(message([textBlock('a'), textBlock('b')]));
    expect(r).toEqual({ text: 'a\nb', sources: [], webSearchQueries: [] });
  });

  it('collects web citations as sources (deduped, with title fallback and cited text)', () => {
    const r = parseAnthropicResponse(
      message([
        textBlock('x', [
          webCitation('https://a.ro/1', 'Titlu A', 'citat'),
          webCitation('https://a.ro/1', 'dup', 'dup'),
          webCitation('https://b.ro/2', null, 'alt citat'),
          charCitation(),
        ]),
      ]),
    );
    expect(r.sources).toEqual([
      { url: 'https://a.ro/1', title: 'Titlu A', citedText: 'citat' },
      { url: 'https://b.ro/2', title: 'Sursa verificata', citedText: 'alt citat' },
    ]);
  });

  it('records server-side web search queries and ignores inputs without a query', () => {
    const r = parseAnthropicResponse(
      message([serverToolUse('s1', { query: 'email legea 544 primaria pitesti' }), serverToolUse('s2', { nope: 1 }), serverToolUse('s3', null)]),
    );
    expect(r.webSearchQueries).toEqual(['email legea 544 primaria pitesti']);
  });

  it('turns web search results into sources, skipping URLs already cited and error results', () => {
    const r = parseAnthropicResponse(
      message([
        textBlock('x', [webCitation('https://a.ro/1', 'A')]),
        webSearchResults('s1', [
          { url: 'https://a.ro/1', title: 'A again' },
          { url: 'https://c.ro/3', title: '' },
        ]),
        webSearchError('s2'),
      ]),
    );
    expect(r.sources).toEqual([
      { url: 'https://a.ro/1', title: 'A', citedText: 'fragment citat' },
      { url: 'https://c.ro/3', title: 'Sursa web' },
    ]);
  });

  it('ignores custom tool_use blocks', () => {
    const r = parseAnthropicResponse(message([toolUse('t1', 'rag_search', { query: 'q' })], 'tool_use'));
    expect(r).toEqual({ text: '', sources: [], webSearchQueries: [] });
  });

  it('parses a realistic STEP_2 answer', () => {
    const r = parseAnthropicResponse(step2Answer());
    expect(r.text).toContain('🏛INSTITUȚIE_IDENTIFICATĂ: Ministerul Afacerilor Interne');
    expect(r.text).toContain('relatii.publice@mai.gov.ro');
    expect(r.webSearchQueries).toEqual(['email legea 544 Ministerul Afacerilor Interne site oficial']);
    expect(r.sources.map((s) => s.url)).toEqual(['https://www.mai.gov.ro/informatii-publice/', 'https://www.mai.gov.ro/contact/']);
    expect(r.sources[0].title).toBe('Informații de interes public - MAI');
    expect(r.sources[0].citedText).toBeUndefined(); // first seen via the search results block
  });
});

describe('webSearchCount', () => {
  it('reads usage.server_tool_use.web_search_requests, defaulting to 0', () => {
    expect(webSearchCount(usage(3))).toBe(3);
    expect(webSearchCount(usage(null))).toBe(0);
  });
});
