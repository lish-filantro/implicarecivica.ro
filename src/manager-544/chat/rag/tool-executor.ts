/**
 * Executor for the custom `rag_search` tool: maps the model's tool input onto
 * searchInstitutii, falling back to the locality extracted from the conversation,
 * and returns an explicit note instead of an empty array so the model knows to
 * rephrase or use web_search.
 */
import type { ToolExecutor } from '@m544/chat/anthropic/loop';
import { searchInstitutii, type RagInstitutionResult, type RagSearchOptions } from './institutii-rag';

export type SearchInstitutiiFn = (query: string, opts?: RagSearchOptions) => RagInstitutionResult[];

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 10;

export const NO_RESULTS_NOTE =
  'Nicio institutie gasita pentru acesti termeni. Reformuleaza cu alte cuvinte cheie despre problema sau foloseste web_search.';

interface RagSearchInput {
  query: string;
  top_k?: number;
  localitate?: string;
  judet?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Tolerant parse of the tool input (the model may omit or mistype fields). */
export function parseRagSearchInput(input: unknown): RagSearchInput {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  return {
    query: str(o.query) ?? '',
    top_k: typeof o.top_k === 'number' ? o.top_k : undefined,
    localitate: str(o.localitate),
    judet: str(o.judet),
  };
}

export function createRagSearchExecutor(
  conversationLocalitate: string | undefined,
  search: SearchInstitutiiFn = searchInstitutii,
): ToolExecutor {
  return (rawInput: unknown) => {
    const input = parseRagSearchInput(rawInput);
    const topK = Math.min(input.top_k || DEFAULT_TOP_K, MAX_TOP_K);
    const localitate = input.localitate || conversationLocalitate || undefined;
    const judet = input.judet || undefined;

    console.log(`  RAG search: "${input.query}" (top ${topK}, loc=${localitate || '-'}, jud=${judet || '-'})`);
    const hits = search(input.query, { topK, localitate, judet });
    console.log(`  RAG returned ${hits.length} results: ${hits.map((r) => r.slug).join(', ')}`);

    return hits.length > 0 ? hits : { rezultate: [], nota: NO_RESULTS_NOTE };
  };
}
