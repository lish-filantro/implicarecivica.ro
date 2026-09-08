/**
 * Hand-built Anthropic Messages API fixtures, typed against the SDK so the
 * parser/loop tests exercise the real block shapes (text with web citations,
 * server_tool_use, web_search_tool_result, tool_use) without any network call.
 */
import type Anthropic from '@anthropic-ai/sdk';


const direct: Anthropic.Messages.DirectCaller = { type: 'direct' };

export function textBlock(text: string, citations: Anthropic.Messages.TextCitation[] | null = null): Anthropic.Messages.TextBlock {
  return { type: 'text', text, citations };
}

export function webCitation(url: string, title: string | null, cited_text = 'fragment citat'): Anthropic.Messages.CitationsWebSearchResultLocation {
  return { type: 'web_search_result_location', url, title, cited_text, encrypted_index: 'enc-idx' };
}

export function charCitation(): Anthropic.Messages.CitationCharLocation {
  return {
    type: 'char_location',
    cited_text: 'x',
    document_index: 0,
    document_title: null,
    start_char_index: 0,
    end_char_index: 1,
    file_id: null,
  };
}

export function serverToolUse(id: string, input: unknown): Anthropic.Messages.ServerToolUseBlock {
  return { type: 'server_tool_use', id, name: 'web_search', input, caller: direct };
}

export function webSearchResults(
  tool_use_id: string,
  results: Array<{ url: string; title: string }>,
): Anthropic.Messages.WebSearchToolResultBlock {
  return {
    type: 'web_search_tool_result',
    tool_use_id,
    caller: direct,
    content: results.map((r) => ({
      type: 'web_search_result' as const,
      url: r.url,
      title: r.title,
      encrypted_content: 'enc',
      page_age: null,
    })),
  };
}

export function webSearchError(tool_use_id: string): Anthropic.Messages.WebSearchToolResultBlock {
  return {
    type: 'web_search_tool_result',
    tool_use_id,
    caller: direct,
    content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
  };
}

export function toolUse(id: string, name: string, input: unknown): Anthropic.Messages.ToolUseBlock {
  return { type: 'tool_use', id, name, input, caller: direct };
}

export function usage(webSearchRequests: number | null = null): Anthropic.Messages.Usage {
  return {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    inference_geo: null,
    service_tier: 'standard',
    server_tool_use:
      webSearchRequests === null ? null : { web_search_requests: webSearchRequests, web_fetch_requests: 0 },
  };
}

export function message(
  content: Anthropic.Messages.ContentBlock[],
  stop_reason: Anthropic.Messages.StopReason = 'end_turn',
  u: Anthropic.Messages.Usage = usage(),
): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content,
    stop_reason,
    stop_sequence: null,
    container: null,
    usage: u,
  };
}

/** Realistic final STEP_2 answer: text + web citation + prior server search + results. */
export function step2Answer(): Anthropic.Messages.Message {
  return message([
    serverToolUse('srvtoolu_1', { query: 'email legea 544 Ministerul Afacerilor Interne site oficial' }),
    webSearchResults('srvtoolu_1', [
      { url: 'https://www.mai.gov.ro/informatii-publice/', title: 'Informații de interes public - MAI' },
      { url: 'https://www.mai.gov.ro/contact/', title: 'Contact - MAI' },
    ]),
    textBlock('🏛INSTITUȚIE_IDENTIFICATĂ: Ministerul Afacerilor Interne\n\n'),
    textBlock(
      'Emailul pentru cereri Legea 544: relatii.publice@mai.gov.ro',
      [webCitation('https://www.mai.gov.ro/informatii-publice/', 'Informații de interes public - MAI', 'relatii.publice@mai.gov.ro')],
    ),
    textBlock('\nConfirmă instituția identificată?'),
  ], 'end_turn', usage(1));
}
