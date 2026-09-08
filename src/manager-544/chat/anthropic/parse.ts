/**
 * Extract what the UI needs from a Messages API response: the answer text,
 * the sources (web citations + web search result URLs, de-duplicated) and the
 * queries the model sent to the server-side web search.
 */
import type Anthropic from '@anthropic-ai/sdk';

export interface ChatSource {
  url: string;
  title: string;
  citedText?: string;
}

export interface ParsedResponse {
  text: string;
  sources: ChatSource[];
  webSearchQueries: string[];
}

function isWebCitation(
  cite: Anthropic.Messages.TextCitation,
): cite is Anthropic.Messages.CitationsWebSearchResultLocation {
  return cite.type === 'web_search_result_location';
}

function queryOf(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const q = (input as { query?: unknown }).query;
  return typeof q === 'string' && q.length > 0 ? q : null;
}

class SourceCollector {
  readonly sources: ChatSource[] = [];
  private readonly seen = new Set<string>();

  add(source: ChatSource): void {
    if (!source.url || this.seen.has(source.url)) return;
    this.seen.add(source.url);
    this.sources.push(source);
  }
}

export function parseAnthropicResponse(response: Anthropic.Messages.Message): ParsedResponse {
  const textParts: string[] = [];
  const collector = new SourceCollector();
  const webSearchQueries: string[] = [];

  for (const block of response.content) {
    switch (block.type) {
      case 'text':
        textParts.push(block.text);
        for (const cite of block.citations ?? []) {
          if (isWebCitation(cite)) {
            collector.add({ url: cite.url, title: cite.title || 'Sursa verificata', citedText: cite.cited_text });
          }
        }
        break;
      case 'server_tool_use': {
        const query = queryOf(block.input);
        if (query) {
          webSearchQueries.push(query);
          console.log(`  Web search query: "${query}"`);
        }
        break;
      }
      case 'web_search_tool_result':
        if (Array.isArray(block.content)) {
          for (const result of block.content) {
            collector.add({ url: result.url, title: result.title || 'Sursa web' });
          }
        }
        break;
      default:
        break;
    }
  }

  return { text: textParts.join('\n'), sources: collector.sources, webSearchQueries };
}

/** Number of server-side web searches billed for this response. */
export function webSearchCount(usage: Anthropic.Messages.Usage): number {
  return usage.server_tool_use?.web_search_requests ?? 0;
}
