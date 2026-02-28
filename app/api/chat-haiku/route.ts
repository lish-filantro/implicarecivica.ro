/**
 * Chat endpoint — Claude Haiku 4.5 + RAG (ChromaDB) + Web Search (native Anthropic)
 *
 * Tools:
 *   - rag_search (custom)         → ChromaDB local / Supabase pgvector
 *   - web_search (server-side)    → Anthropic native (Brave Search), executat automat
 *
 * Endpoint: POST /api/chat-haiku
 * Health:   GET  /api/chat-haiku
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { MISTRAL_AGENT_INSTRUCTIONS } from '@/lib/mistral/constants';
import {
  getStepGuardrail,
  extractProblemContext,
  sanitizeMessage,
  isPromptInjectionAttempt,
  isOffTopic,
  MAX_MESSAGE_LENGTH,
} from '@/lib/guardrails';
import {
  extractEmails,
  scoreEmailConfidence,
} from '@/lib/email-validation';
import {
  validateOutput,
  sanitizeOutput,
  getFallbackResponse,
} from '@/lib/output-validation';
import {
  ChromaVectorStore,
  SupabaseVectorStore,
  type VectorStore,
  type SearchResult,
} from '@/lib/rag/vector-store';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const CHROMA_COLLECTION = process.env.CHROMA_COLLECTION || 'institutii_publice';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

// Use Supabase pgvector in production, ChromaDB locally
const USE_SUPABASE_RAG =
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ||
  process.env.USE_SUPABASE_RAG === 'true';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const getAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOLS — rag_search (custom) + web_search (server-side Anthropic)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build tools array. Web search gets dynamic user_location based on
 * the localitate extracted from conversation context.
 */
function buildTools(localitate?: string): Anthropic.Tool[] {
  return [
    // Custom tool — we execute this ourselves via ChromaDB
    {
      name: 'rag_search',
      description:
        'Cauta in baza de cunostinte informatii relevante despre Legea 544/2001, institutii publice din Romania, atributii institutionale si proceduri de acces la informatii publice. Foloseste acest tool cand ai nevoie de context despre lege, cine e responsabil pentru ce, sau exemple de probleme similare.',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description:
              'Interogare de cautare in limba romana (ex: "Primaria atributii drumuri locale")',
          },
          top_k: {
            type: 'number',
            description: 'Numar de rezultate (default: 5, max: 10)',
          },
        },
        required: ['query'],
      },
    },
    // Server-side tool — Anthropic executes this automatically via Brave Search
    // No allowed_domains filter — Haiku's system prompt directs it to .ro/.gov.ro
    // Wildcard on domains (*.ro) is invalid; subdomains are auto-included but
    // filtering to all of .ro is not possible. Let Haiku search freely.
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5,
    } as any,
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RAG EXECUTOR (only custom tool — web search is automatic)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createVectorStore(): VectorStore {
  if (USE_SUPABASE_RAG) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const embedFn = async (text: string): Promise<number[]> => {
      const res = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      return res.data[0].embedding;
    };

    console.log('RAG: Using Supabase pgvector');
    return new SupabaseVectorStore(supabase, embedFn);
  }

  console.log('RAG: Using ChromaDB (local)');
  return new ChromaVectorStore(CHROMA_COLLECTION, CHROMA_URL);
}

const vectorStore = createVectorStore();

async function executeRagSearch(
  query: string,
  topK = 5,
): Promise<SearchResult[]> {
  console.log(`  RAG search: "${query}" (top ${topK})`);
  const results = await vectorStore.search(query, Math.min(topK, 10));
  console.log(`  RAG returned ${results.length} results`);
  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESPONSE PARSING — extract sources and citations from Anthropic response
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ParsedResponse {
  text: string;
  sources: Array<{ url: string; title: string; citedText?: string }>;
  webSearchQueries: string[];
}

function parseAnthropicResponse(response: Anthropic.Message): ParsedResponse {
  const textParts: string[] = [];
  const sources: Array<{ url: string; title: string; citedText?: string }> = [];
  const seenUrls = new Set<string>();
  const webSearchQueries: string[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textParts.push(block.text);

      // Extract citations from text blocks
      const citations = (block as any).citations;
      if (Array.isArray(citations)) {
        for (const cite of citations) {
          if (cite.url && !seenUrls.has(cite.url)) {
            seenUrls.add(cite.url);
            sources.push({
              url: cite.url,
              title: cite.title || 'Sursa verificata',
              citedText: cite.cited_text,
            });
          }
        }
      }
    }

    // Server tool use — Claude decided to search (query is logged)
    if (block.type === 'server_tool_use') {
      const input = (block as any).input;
      if (input?.query) {
        webSearchQueries.push(input.query);
        console.log(`  Web search query: "${input.query}"`);
      }
    }

    // Web search results — extract URLs as sources
    if (block.type === 'web_search_tool_result') {
      const content = (block as any).content;
      if (Array.isArray(content)) {
        for (const result of content) {
          if (result.type === 'web_search_result' && result.url && !seenUrls.has(result.url)) {
            seenUrls.add(result.url);
            sources.push({
              url: result.url,
              title: result.title || 'Sursa web',
            });
          }
        }
      }
    }
  }

  return {
    text: textParts.join('\n'),
    sources,
    webSearchQueries,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOOL_INSTRUCTIONS = `

### INSTRUCȚIUNI TOOLS:
Ai acces la 2 tool-uri. Foloseste-le strategic:

1. **rag_search** — Cauta in baza de cunostinte LOCALA cu informatii despre institutii publice din Romania.
   - La STEP_1: poti folosi pentru a intelege mai bine tipul de problema
   - La STEP_2: foloseste OBLIGATORIU pentru a identifica institutia responsabila
   - La STEP_3: poti folosi pentru template-uri de intrebari strategice

2. **web_search** — Cautare web nativa (executata automat server-side).
   - Foloseste la STEP_2, DUPA ce ai identificat institutia, pentru a gasi emailul oficial Legea 544
   - Cauta pe site-ul OFICIAL al institutiei (domeniu .gov.ro sau .ro)
   - Cauta in paginile: "Transparenta decizionala", "Legea 544", "Contact", "Informatii de interes public"
   - Prioritizeaza emailul SPECIFIC pentru cereri Legea 544 (ex: "solicitari544@...", "informatii.publice@...", "transparenta@...")
   - Daca nu gasesti email specific 544, cauta emailul de registratura/secretariat
   - NU inventa emailuri. Daca nu gasesti, spune clar ca nu ai gasit.

REGULI TOOLS:
- NU folosi tools pentru salut, confirmare, sau conversatie generala
- Cand folosesti rag_search, formuleaza query-ul CONCRET (ex: "atributii primarie drumuri locale" nu "ce face primaria")
- Cand primesti rezultate RAG, citeaza informatia relevanta in raspunsul tau
- Cand faci web search pentru email, include "legea 544" si numele institutiei in cautare
- Raspunde INTOTDEAUNA in romana

OVERRIDE IMPORTANT — CAUTARE EMAIL:
Instructiunea "NU furniza email - emailul va fi cautat AUTOMAT de sistem" NU se aplica aici.
TU esti responsabil sa cauti emailul.

FLOW OBLIGATORIU LA STEP_2 (totul intr-un SINGUR raspuns, fara sa astepti confirmare):
1. Userul confirma problema → tu faci rag_search pentru a identifica institutia
2. IMEDIAT dupa ce ai identificat institutia, IN ACELASI RASPUNS, faci web_search
   - Query: "email legea 544 [numele institutiei] site oficial"
   - Daca nu gasesti: "contact [numele institutiei] informatii interes public"
3. Prezinti TOTUL intr-un singur mesaj:
   - Institutia identificata (cu INSTITUȚIE_IDENTIFICATĂ marker)
   - Emailul gasit (sau spune clar ca nu ai gasit)
   - Sursele URL
   - Intrebi userul daca confirma institutia

NU prezenta institutia si apoi astepta confirmare inainte de web search.
NU face doi pasi separati. Totul e UN SINGUR raspuns.`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  conversationHistory?: ChatMessage[];
  conversationId?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/chat-haiku
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      conversationHistory = [],
      conversationId,
    }: ChatRequest = await request.json();

    // ━━━ Input validation ━━━
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Mesajul este obligatoriu' },
        { status: 400 },
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          error: `Mesajul depaseste limita de ${MAX_MESSAGE_LENGTH} caractere`,
        },
        { status: 400 },
      );
    }

    // ━━━ Prompt injection — block immediately ━━━
    if (isPromptInjectionAttempt(message)) {
      console.warn('PROMPT INJECTION BLOCKED');
      return NextResponse.json({
        response:
          'Sunt specializat doar pe Legea 544/2001. Te rog sa formulezi o intrebare legata de accesul la informatii de interes public.',
        sources: [],
        webSearches: [],
        model: HAIKU_MODEL,
      });
    }

    // ━━━ Off-topic — block immediately ━━━
    if (isOffTopic(message)) {
      return NextResponse.json({
        response:
          'Sunt specializat doar pe Legea 544/2001. Cu ce te pot ajuta in legatura cu formularea unei cereri?',
        sources: [],
        webSearches: [],
        model: HAIKU_MODEL,
      });
    }

    // ━━━ Anthropic client ━━━
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json(
        {
          error: 'ANTHROPIC_API_KEY nu este configurat',
          details: 'Adauga ANTHROPIC_API_KEY in .env.local',
        },
        { status: 500 },
      );
    }

    const sanitizedMessage = sanitizeMessage(message);

    // ━━━ Step detection + guardrail ━━━
    const historyForDetection = conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const { step: currentStep, guardrail: stepGuardrail } =
      getStepGuardrail(historyForDetection);

    // Extract localitate for web search geo-targeting
    const context = extractProblemContext(historyForDetection);
    const localitate = context.localitate || '';

    console.log(
      `Step: ${currentStep} | Model: ${HAIKU_MODEL} | Localitate: ${localitate || '(none)'}`,
    );

    // ━━━ Build tools with dynamic location ━━━
    const tools = buildTools(localitate || undefined);

    // ━━━ Build Anthropic messages (must alternate user/assistant) ━━━
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const msg of conversationHistory) {
      if (msg.role === 'system') continue;

      const lastMsgRole =
        anthropicMessages.length > 0
          ? anthropicMessages[anthropicMessages.length - 1].role
          : null;

      if (msg.role === lastMsgRole) {
        // Merge consecutive same-role messages
        const prev = anthropicMessages[anthropicMessages.length - 1];
        prev.content = `${prev.content}\n\n${msg.content}`;
      } else {
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Append current user message
    const lastMsgRole =
      anthropicMessages.length > 0
        ? anthropicMessages[anthropicMessages.length - 1].role
        : null;

    if (lastMsgRole === 'user') {
      const prev = anthropicMessages[anthropicMessages.length - 1];
      prev.content = `${prev.content}\n\n${sanitizedMessage}`;
    } else {
      anthropicMessages.push({ role: 'user', content: sanitizedMessage });
    }

    // Anthropic requires first message to be 'user'
    if (
      anthropicMessages.length > 0 &&
      anthropicMessages[0].role !== 'user'
    ) {
      anthropicMessages.unshift({
        role: 'user',
        content: '(start conversatie)',
      });
    }

    // ━━━ System prompt = workflow + tools + step guardrail ━━━
    const systemPrompt =
      MISTRAL_AGENT_INSTRUCTIONS + TOOL_INSTRUCTIONS + '\n\n' + stepGuardrail;

    // ━━━ Call Haiku 4.5 with tools ━━━
    let response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: anthropicMessages,
    });

    // ━━━ Agentic loop — only for custom tools (rag_search) ━━━
    // Web search (server_tool_use) is handled automatically by Anthropic API.
    // We only loop when stop_reason === 'tool_use' (our custom tools need execution).
    // Also handle 'pause_turn' — pass response back as-is to let Claude continue.
    let iterations = 0;
    const MAX_ITERATIONS = 8;

    while (
      (response.stop_reason === 'tool_use' ||
        response.stop_reason === 'pause_turn') &&
      iterations < MAX_ITERATIONS
    ) {
      iterations++;

      if (response.stop_reason === 'pause_turn') {
        // Turn took too long — pass back as-is to continue
        console.log(`  Pause turn — continuing (iteration ${iterations})`);
        anthropicMessages.push({
          role: 'assistant',
          content: response.content,
        });
        anthropicMessages.push({
          role: 'user',
          content: [{ type: 'text', text: 'Continua.' }],
        });

        response = await anthropic.messages.create({
          model: HAIKU_MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          tools,
          messages: anthropicMessages,
        });
        continue;
      }

      // stop_reason === 'tool_use' — execute our custom tools
      console.log(`  Custom tool iteration ${iterations}/${MAX_ITERATIONS}`);

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        let result: unknown;
        try {
          if (block.name === 'rag_search') {
            const input = block.input as { query: string; top_k?: number };
            result = await executeRagSearch(input.query, input.top_k || 5);
          } else {
            result = { error: `Tool necunoscut: ${block.name}` };
          }
        } catch (error: any) {
          console.error(`  Tool ${block.name} failed:`, error.message);
          result = { error: error.message };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      // Append assistant response + tool results, then re-call
      anthropicMessages.push({
        role: 'assistant',
        content: response.content,
      });
      anthropicMessages.push({
        role: 'user',
        content: toolResults,
      });

      response = await anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: anthropicMessages,
      });
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn('Max tool iterations reached');
    }

    // ━━━ Parse response — text, citations, web search queries ━━━
    const parsed = parseAnthropicResponse(response);

    let responseText = parsed.text;
    const allSources = parsed.sources;
    const allWebSearches = parsed.webSearchQueries;

    // ━━━ Post-process: validate emails found in response ━━━
    const foundEmails = extractEmails(responseText);
    if (foundEmails.length > 0 && currentStep === 'STEP_2') {
      const scored = foundEmails.map((e) =>
        scoreEmailConfidence(
          e,
          '', // institution name extracted by Haiku
          allSources.map((s) => s.url),
          responseText,
        ),
      );
      scored.sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return order[b.confidence] - order[a.confidence];
      });
      const best = scored[0];
      console.log(
        `  Email validation: ${best.email} (${best.confidence}) — ${best.confidenceReasons.join('; ')}`,
      );

      // Append confidence warning if LOW
      if (best.confidence === 'low') {
        responseText +=
          '\n\n⚠️ **ATENȚIE:** Nivelul de încredere pentru acest email este scăzut. Te rugăm SĂ VERIFICI manual emailul pe site-ul oficial al instituției înainte de a trimite cererea.';
      }
    }

    // ━━━ Output validation ━━━
    const validation = validateOutput(responseText, currentStep);
    if (validation.containsSystemLeak) {
      console.error('SYSTEM PROMPT LEAK DETECTED');
      responseText = sanitizeOutput(responseText);
    }
    if (responseText.length < 10) {
      responseText = getFallbackResponse(currentStep);
    }

    // Extract any remaining URLs from response text
    const urlRegex = /https?:\/\/[^\s)>\]]+/g;
    const urls = responseText.match(urlRegex);
    if (urls) {
      for (const rawUrl of urls) {
        const cleanUrl = rawUrl.replace(/[).\],;:]+$/, '');
        if (!allSources.some((s) => s.url === cleanUrl)) {
          allSources.push({ url: cleanUrl, title: 'Sursa' });
        }
      }
    }

    // Token usage (includes web search count)
    const usage = response.usage as any;
    const webSearchCount =
      usage?.server_tool_use?.web_search_requests || 0;

    return NextResponse.json({
      response: responseText,
      sources: allSources,
      webSearches: allWebSearches,
      model: HAIKU_MODEL,
      conversationId: conversationId || null,
      toolIterations: iterations,
      webSearchCount,
    });
  } catch (error: any) {
    console.error('Chat Haiku Error:', error);

    if (error.status === 401) {
      return NextResponse.json(
        {
          error: 'ANTHROPIC_API_KEY invalid',
          details: 'Verifica cheia in .env.local',
        },
        { status: 401 },
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        {
          error: 'Rate limit atins',
          details: 'Asteapta cateva secunde si incearca din nou.',
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: 'Eroare interna',
        details: error.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/chat-haiku — health check
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET() {
  const anthropicOk = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    status: 'online',
    model: HAIKU_MODEL,
    anthropicConfigured: anthropicOk,
    ragBackend: USE_SUPABASE_RAG ? 'supabase-pgvector' : 'chromadb-local',
    ...(USE_SUPABASE_RAG
      ? { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL }
      : { chromaUrl: CHROMA_URL, chromaCollection: CHROMA_COLLECTION }),
    tools: ['rag_search (custom)', 'web_search (server-side Anthropic/Brave)'],
    guardrailsEnabled: true,
    webSearchProvider: 'Anthropic native (Brave Search)',
  });
}
