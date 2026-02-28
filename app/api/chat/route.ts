import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
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
  type EmailValidationResult,
} from '@/lib/email-validation';
import {
  validateOutput,
  sanitizeOutput,
  getFallbackResponse,
} from '@/lib/output-validation';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  conversationHistory?: ChatMessage[];
  conversationId?: string;
}

interface WebSearchResult {
  text: string;
  sources: Array<{ url: string; title: string }>;
  validatedEmail: EmailValidationResult | null;
}

// OpenAI fine-tuned model (institution identification + conversational flow)
const OPENAI_MODEL = 'ft:gpt-4o-mini-2024-07-18:personal:civic-v2:D8rtdl56';

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY not configured');
    return null;
  }

  return new OpenAI({ apiKey });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL SEARCH CACHE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const emailCache = new Map<string, {
  result: WebSearchResult;
  timestamp: number;
}>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function normalizeInstitutionKey(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract URL citation sources from OpenAI Responses API output.
 * Shared between primary search and verification pass.
 */
function extractSourcesFromResponse(response: any): Array<{ url: string; title: string }> {
  const sources: Array<{ url: string; title: string }> = [];
  for (const item of response.output || []) {
    if (item.type === 'message' && 'content' in item) {
      for (const content of (item as any).content || []) {
        if (content.annotations) {
          for (const annotation of content.annotations) {
            if (annotation.type === 'url_citation') {
              sources.push({
                url: annotation.url,
                title: annotation.title || 'Sursă verificată',
              });
            }
          }
        }
      }
    }
  }
  return sources;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEB SEARCH — 2-pass: search + verify
// Uses base gpt-4o-mini (NOT fine-tuned) via Responses API + web_search_preview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function searchInstitutionEmail(
  institution: string,
  localitate: string,
  client: OpenAI
): Promise<WebSearchResult | null> {
  // Check cache first
  const cacheKey = normalizeInstitutionKey(institution);
  const cached = emailCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`📦 Cache hit for: "${institution}"`);
    return cached.result;
  }

  try {
    console.log(`🔍 PASS 1: Căutare email Legea 544 pentru "${institution}"`);

    // PASS 1: Primary search with high context and specific location
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      tools: [{
        type: 'web_search_preview' as any,
        search_context_size: 'high',
        user_location: {
          type: 'approximate',
          country: 'RO',
          ...(localitate ? { city: localitate, region: localitate } : {}),
        },
      }],
      temperature: 0,
      input: `Caută pe site-ul OFICIAL al instituției "${institution}" adresa de email pentru cereri conform Legii 544/2001 privind accesul la informații de interes public.

INSTRUCȚIUNI STRICTE:
1. Caută DOAR pe domenii .gov.ro sau pe site-ul oficial al instituției (domeniu .ro)
2. Caută în paginile: "Transparență decizională", "Legea 544", "Informații de interes public", "Contact", "Relații cu publicul"
3. Prioritizează emailul SPECIFIC pentru cereri Legea 544 (ex: "solicitari544@...", "informatii.publice@...", "transparenta@...")
4. Dacă nu există email specific 544, caută emailul de registratură/secretariat
5. NU inventa emailuri. Dacă nu găsești, spune clar "Nu am găsit email."

Răspunde STRICT în formatul:
EMAIL: [adresa exactă sau "NEGĂSIT"]
TIP: [specific Legea 544 / registratură generală / NEGĂSIT]
SURSĂ: [URL-ul paginii unde l-ai găsit]
PAGINĂ: [titlul paginii]`,
    });

    let text = response.output_text || '';
    let sources = extractSourcesFromResponse(response);

    // Extract emails from response
    let emails = extractEmails(text);

    // RETRY: If no email found, try a simpler direct query
    if (emails.length === 0) {
      console.log(`🔄 PASS 1 returned no email. Retrying with simpler query...`);
      try {
        const retryResponse = await client.responses.create({
          model: 'gpt-4o-mini',
          tools: [{
            type: 'web_search_preview' as any,
            search_context_size: 'high',
            user_location: { type: 'approximate', country: 'RO' },
          }],
          temperature: 0,
          input: `email contact "${institution}" legea 544 site:.ro`,
        });
        const retryText = retryResponse.output_text || '';
        const retrySources = extractSourcesFromResponse(retryResponse);
        const retryEmails = extractEmails(retryText);
        if (retryEmails.length > 0) {
          console.log(`✅ Retry found ${retryEmails.length} email(s)`);
          text = retryText;
          sources = retrySources;
          emails = retryEmails;
        }
      } catch (retryError) {
        console.warn('⚠️ Retry search failed:', retryError);
      }
    }

    // Validate extracted emails
    let validatedEmail: EmailValidationResult | null = null;

    if (emails.length > 0) {
      // Score each email, pick the best
      const scored = emails.map(e =>
        scoreEmailConfidence(e, institution, sources.map(s => s.url), text)
      );
      scored.sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return order[b.confidence] - order[a.confidence];
      });
      validatedEmail = scored[0];

      console.log(`📧 Best email: ${validatedEmail.email} (${validatedEmail.confidence})`);

      // PASS 2: Verification — only if confidence is NOT high
      if (validatedEmail.confidence !== 'high') {
        console.log(`🔍 PASS 2: Verificare "${validatedEmail.email}" pentru "${institution}"`);

        try {
          const verifyResponse = await client.responses.create({
            model: 'gpt-4o-mini',
            tools: [{
              type: 'web_search_preview' as any,
              search_context_size: 'high',
              user_location: { type: 'approximate', country: 'RO' },
            }],
            temperature: 0,
            input: `Verifică: este "${validatedEmail.email}" adresa oficială de email a instituției "${institution}" pentru cereri conform Legii 544/2001?

Caută pe site-ul oficial al instituției. Confirmă sau infirmă.
Răspunde cu: CONFIRMAT sau NECONFIRMAT, cu URL-ul sursei.`,
          });

          const verifyText = verifyResponse.output_text || '';
          const verifySources = extractSourcesFromResponse(verifyResponse);

          const verifyLower = verifyText.toLowerCase();
          if (verifyLower.includes('confirmat') && !verifyLower.includes('neconfirmat')) {
            // Bump confidence up one level
            if (validatedEmail.confidence === 'low') validatedEmail.confidence = 'medium';
            else if (validatedEmail.confidence === 'medium') validatedEmail.confidence = 'high';
            validatedEmail.confidenceReasons.push('Verificat prin a doua căutare');
            sources.push(...verifySources);
            console.log(`✅ PASS 2: CONFIRMAT → confidence bumped to ${validatedEmail.confidence}`);
          } else {
            validatedEmail.confidenceReasons.push('Neverificat prin a doua căutare');
            console.log(`⚠️ PASS 2: NECONFIRMAT`);
          }
        } catch (verifyError) {
          console.warn('⚠️ PASS 2 failed, continuing with PASS 1 result:', verifyError);
          validatedEmail.confidenceReasons.push('Verificare automată indisponibilă');
        }
      }
    }

    console.log(`✅ Search complete: email=${validatedEmail?.email || 'NONE'}, confidence=${validatedEmail?.confidence || 'N/A'}, surse=${sources.length}`);

    const result: WebSearchResult = { text, sources, validatedEmail };

    // Cache only if we found a valid email (don't cache failures)
    if (validatedEmail) {
      emailCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return result;

  } catch (error) {
    console.error('❌ Web search failed:', error);
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INSTITUTION EXTRACTION — extrage numele instituției din răspunsul modelului
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractInstitutionName(text: string): string | null {
  // Pattern 1: format explicit 🏛INSTITUȚIE_IDENTIFICATĂ: Primăria Pitești
  const pattern1 = text.match(
    /INSTITUȚIE_IDENTIFICATĂ[:\s]+(?:Tip:)?\s*(.+?)(?:\n|📧|🔗|\/\s|$)/i
  );
  if (pattern1) {
    return pattern1[1].replace(/\*+/g, '').trim();
  }

  // Pattern 2: instituții comune în text liber
  const pattern2 = text.match(
    /(Prim[aă]ria(?:\s+(?:Municipiului|Orașului|Comunei))?\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+|Consiliul\s+Jude[tț]ean\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+|Ministerul\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+|Agen[tț]ia\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+|Direc[tț]ia\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+|Inspectoratul\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+|Prefectura\s+[A-ZȘȚĂÎÂa-zșțăîâ\s-]+)/i
  );
  if (pattern2) {
    return pattern2[1].replace(/[\s,;.]+$/, '').trim();
  }

  return null;
}

/**
 * Formatează rezultatul web search cu confidence scoring vizual
 */
function formatEmailSearchResult(searchResult: WebSearchResult): string {
  let formatted = '\n\n---\n';

  if (searchResult.validatedEmail) {
    const v = searchResult.validatedEmail;
    const confidenceEmoji = v.confidence === 'high' ? '🟢' : v.confidence === 'medium' ? '🟡' : '🔴';
    const confidenceLabel = v.confidence === 'high' ? 'RIDICAT' : v.confidence === 'medium' ? 'MEDIU' : 'SCĂZUT';

    formatted += `📧 **Email identificat:** ${v.email}\n`;
    formatted += `${confidenceEmoji} **Nivel de încredere:** ${confidenceLabel}\n`;

    if (v.confidence === 'low') {
      formatted += `\n⚠️ **ATENȚIE:** Nivelul de încredere este scăzut. Te rugăm SĂ VERIFICI manual emailul pe site-ul oficial al instituției înainte de a trimite cererea.\n`;
    }

    if (v.isGovRo) {
      formatted += `✅ Domeniu .gov.ro verificat\n`;
    }

    formatted += `\n**Detalii verificare:**\n`;
    v.confidenceReasons.forEach(reason => {
      formatted += `- ${reason}\n`;
    });
  } else {
    formatted += `⚠️ **Nu s-a putut identifica un email valid.** `;
    formatted += `Te rugăm să cauți manual pe site-ul oficial al instituției, la secțiunea "Legea 544" sau "Transparență decizională".\n`;
  }

  if (searchResult.sources.length > 0) {
    formatted += '\n🔗 **Surse consultate:**\n';
    const seen = new Set<string>();
    let idx = 0;
    searchResult.sources.forEach(source => {
      if (!seen.has(source.url)) {
        seen.add(source.url);
        idx++;
        formatted += `${idx}. [${source.title}](${source.url})\n`;
      }
    });
  }

  formatted += '\n⚠️ **Verifică tu însuți link-ul și emailul înainte de a trimite cererea. Confirmă după verificare.**';
  return formatted;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN CHAT ENDPOINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [], conversationId: receivedConversationId }: ChatRequest = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Mesajul este obligatoriu' },
        { status: 400 }
      );
    }

    // ━━━ Input length validation ━━━
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Mesajul este prea lung. Limita este de ${MAX_MESSAGE_LENGTH} de caractere.` },
        { status: 400 }
      );
    }

    // ━━━ Prompt injection — SHORT-CIRCUIT (return immediately, do NOT send to model) ━━━
    if (isPromptInjectionAttempt(message)) {
      console.warn('🚨 PROMPT INJECTION BLOCKED:', message.length, 'chars');
      return NextResponse.json({
        response: 'Sunt specializat doar pe Legea 544/2001. Te rog să formulezi o întrebare legată de accesul la informații de interes public.',
        sources: [],
        webSearches: [],
        model: OPENAI_MODEL,
        conversationId: null,
      });
    }

    // ━━━ Off-topic — SHORT-CIRCUIT ━━━
    if (isOffTopic(message)) {
      console.log('📵 Off-topic message blocked');
      return NextResponse.json({
        response: 'Sunt specializat doar pe Legea 544/2001 privind accesul la informații de interes public. Cu ce te pot ajuta în legătură cu formularea unei cereri?',
        sources: [],
        webSearches: [],
        model: OPENAI_MODEL,
        conversationId: null,
      });
    }

    const client = getOpenAIClient();

    // Fallback to mock mode if no client
    if (!client) {
      console.warn('⚠️ OpenAI client nu este configurat - folosesc răspuns mock');
      return NextResponse.json({
        response: `Înțeleg că întrebi despre **${message}**.\n\n` +
          `În conformitate cu **Legea 544/2001**, ai dreptul să soliciți informații de interes public de la orice autoritate publică.\n\n` +
          `### Pași recomandați:\n` +
          `1. Completează formularul din dreapta cu datele tale\n` +
          `2. Specifică exact ce informații dorești în secțiunea "Conținutul Cererii"\n` +
          `3. Trimite cererea către instituția publică relevantă\n\n` +
          `⚠️ **Notă**: Acesta este un răspuns de test. Pentru răspunsuri AI reale, configurează OPENAI_API_KEY în .env.local`,
        sources: [],
        webSearches: [],
        model: OPENAI_MODEL,
      });
    }

    try {
      console.log(`💬 ${receivedConversationId ? 'Continuing' : 'Starting'} conversation...`);

      // ━━━ Sanitize input ━━━
      const sanitizedMessage = sanitizeMessage(message);

      // ━━━ Detect current step & get guardrail ━━━
      const historyForDetection = conversationHistory.map(m => ({ role: m.role, content: m.content }));
      const { step: currentStep, guardrail: stepGuardrail } = getStepGuardrail(historyForDetection);

      console.log(`📍 Current step: ${currentStep}`);

      let responseText = '';
      const allSources: Array<{ url: string; title: string; description?: string }> = [];
      const webSearches: string[] = [];

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP_2: SPECIAL HANDLING — specialist call + web search
      // Fine-tuned model cu system prompt conversațional NU funcționează
      // pentru identificare instituție (repetă STEP_1 în loc să avanseze).
      // Soluție: call SEPARAT cu system prompt MINIMAL.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (currentStep === 'STEP_2') {
        console.log('🏛 STEP_2: Specialist call pentru identificare instituție...');

        // Extract problem context from conversation
        const context = extractProblemContext(historyForDetection);
        const ce = context.ce || 'problema descrisă de utilizator';
        const unde = context.unde || '';
        const localitate = context.localitate || '';

        console.log(`📋 Context extras: CE="${ce}" UNDE="${unde}" LOCALITATE="${localitate}"`);

        // CALL 1: Fine-tuned model with MINIMAL system prompt
        const locationPart = localitate ? ` din ${localitate}` : '';
        const institutionQuery = `Care instituție${locationPart} este responsabilă pentru ${ce}?`;

        console.log(`🤖 Call 1 (specialist): "${institutionQuery}"`);

        const institutionCompletion = await client.chat.completions.create({
          model: OPENAI_MODEL,
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: 'Identifică instituția responsabilă. Răspunde cu numele complet al instituției.',
            },
            {
              role: 'user',
              content: institutionQuery,
            },
          ],
        });

        let institutionAnswer = institutionCompletion.choices[0]?.message?.content || '';
        console.log(`✅ Răspuns brut model: "${institutionAnswer}"`);

        // Pre-clean: strip {LOCALITATE} placeholder BEFORE extraction
        institutionAnswer = institutionAnswer.replace(/\s*\{LOCALITATE\}\s*/gi, ' ');

        // Pre-clean: strip "este responsabilă pentru..." and everything after
        institutionAnswer = institutionAnswer
          .replace(/\s+(este|se ocup[aă]|gestioneaz[aă]|administreaz[aă]|controleaz[aă]|r[aă]spunde|monitorizeaz[aă]).*/i, '')
          .replace(/\.$/, '')
          .trim();

        console.log(`✅ Răspuns pre-curățat: "${institutionAnswer}"`);

        // Extract institution name (tries structured format, then free text patterns)
        let institution = extractInstitutionName(institutionAnswer);
        if (!institution) {
          institution = institutionAnswer.trim();
        }

        console.log(`✅ Instituție curățată: "${institution}"`);

        // Resolve institution to a searchable parent institution.
        // The fine-tuned model often returns department names (e.g., "Direcția Administrarea Domeniului Public")
        // instead of the parent institution (e.g., "Primăria Pitești"). Department names are unsearchable.
        // Map known department patterns to their parent institution type.
        let searchInstitution = institution;
        const isDepartment = /^(Direc[tț]ia|Serviciul|Compartimentul|Biroul)\s/i.test(institution);
        if (isDepartment && localitate) {
          // Department under a city hall — search for the Primăria instead
          searchInstitution = `Primăria ${localitate}`;
          console.log(`🔄 Department detectat → search for parent: "${searchInstitution}"`);
        }

        // Append locality if missing from display name
        const institutionLower = (institution || '').toLowerCase();
        const localLower = localitate.toLowerCase();
        if (institution && localitate && !institutionLower.includes(localLower)) {
          institution = `${institution} ${localitate}`;
          console.log(`📍 Adăugat localitate: "${institution}"`);
        }

        if (institution) {
          // CALL 2: Web search for email (with validation + verification)
          // Use searchInstitution (parent institution) for better search results
          console.log(`🔍 Call 2 (web search): Căutare email pentru "${searchInstitution}"...`);
          webSearches.push(`Email Legea 544 - ${searchInstitution}`);

          const searchResult = await searchInstitutionEmail(searchInstitution, localitate, client);

          // Build the combined response
          responseText = `🏛 **INSTITUȚIE_IDENTIFICATĂ: ${institution}**\n\n`;
          responseText += `Instituția responsabilă pentru ${ce}`;
          responseText += unde ? ` la adresa ${unde}` : '';
          responseText += ` este **${institution}**.`;

          if (searchResult) {
            responseText += formatEmailSearchResult(searchResult);

            // Collect sources (deduplicated)
            const seenUrls = new Set<string>();
            searchResult.sources.forEach(source => {
              if (!seenUrls.has(source.url)) {
                seenUrls.add(source.url);
                allSources.push({
                  url: source.url,
                  title: source.title,
                  description: 'Sursă verificată automat',
                });
              }
            });

            console.log(`✅ Email search completat: ${searchResult.sources.length} surse, email=${searchResult.validatedEmail?.email || 'NONE'}`);
          } else {
            responseText += '\n\n⚠️ **Căutarea automată a emailului nu a returnat rezultate.** Te rugăm să cauți manual emailul pe site-ul oficial al instituției, la secțiunea "Legea 544" sau "Transparență decizională".';
            console.warn('⚠️ Web search nu a returnat rezultate');
          }

          responseText += '\n\nConfirmă instituția identificată?';
        } else {
          responseText = `Nu am reușit să identific instituția responsabilă pentru ${ce}. Te rog să oferi mai multe detalii despre problema ta.`;
          console.warn('⚠️ Nu s-a putut extrage instituția din răspunsul modelului');
        }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP_1 & STEP_3: Standard conversational flow
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      } else {
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        // [1] System prompt at the START
        messages.push({
          role: 'system',
          content: MISTRAL_AGENT_INSTRUCTIONS,
        });

        // [2] Conversation history
        conversationHistory.forEach((msg) => {
          messages.push({ role: msg.role, content: msg.content });
        });

        // [3] Current user message — CLEAN
        messages.push({
          role: 'user',
          content: sanitizedMessage,
        });

        // [4] Step guardrail as SYSTEM message at the END
        messages.push({
          role: 'system',
          content: stepGuardrail,
        });

        console.log(`🤖 Standard call: ${currentStep} (${messages.length} messages)`);

        const completion = await client.chat.completions.create({
          model: OPENAI_MODEL,
          messages: messages,
          temperature: 0.3,
          max_tokens: 2000,
        });

        responseText = completion.choices[0]?.message?.content || '';
        console.log(`✅ Response: ${responseText.length} chars`);

        // ━━━ Output validation ━━━
        const validation = validateOutput(responseText, currentStep);
        if (validation.containsSystemLeak) {
          console.error('🚨 SYSTEM PROMPT LEAK DETECTED in output!');
          responseText = sanitizeOutput(responseText);
        }
        if (responseText.length < 10) {
          console.warn('⚠️ Output too short, using fallback');
          responseText = getFallbackResponse(currentStep);
        }
        if (validation.issues.length > 0) {
          console.warn('⚠️ Output validation issues:', validation.issues);
        }
      }

      // Extract any URLs from the model's response text
      const urlRegex = /https?:\/\/[^\s\)\]\>]+/g;
      const urls = responseText.match(urlRegex);
      if (urls) {
        urls.forEach((url, idx) => {
          const cleanUrl = url.replace(/[\)\]\.,;:]+$/, '');
          if (!allSources.some(s => s.url === cleanUrl)) {
            allSources.push({
              url: cleanUrl,
              title: `Sursă ${idx + 1}`,
              description: '',
            });
          }
        });
      }

      return NextResponse.json({
        response: responseText,
        sources: allSources,
        webSearches: webSearches,
        model: OPENAI_MODEL,
        conversationId: null,
      });

    } catch (error: any) {
      console.error('❌ OpenAI API Error:', error);

      if (error.status === 404) {
        return NextResponse.json(
          {
            error: 'Modelul OpenAI nu a fost găsit',
            details: `Model: ${OPENAI_MODEL}. Verifică că modelul fine-tuned există.`,
          },
          { status: 404 }
        );
      }

      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          {
            error: 'API Key invalid sau lipsește',
            details: 'Verifică OPENAI_API_KEY în .env.local',
          },
          { status: 403 }
        );
      }

      if (error.status === 429) {
        return NextResponse.json(
          {
            error: 'Prea multe cereri',
            details: 'Rate limit atins. Așteaptă câteve secunde și încearcă din nou.',
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: 'Eroare la comunicarea cu OpenAI',
          details: error.message || 'Unknown error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Chat API Error:', error);

    return NextResponse.json(
      {
        error: 'A apărut o eroare la procesarea cererii',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const apiKeyConfigured = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    status: 'online',
    aiConfigured: apiKeyConfigured,
    model: OPENAI_MODEL,
    webSearchEnabled: true,
    guardrailsEnabled: true,
    emailValidationEnabled: true,
    message: apiKeyConfigured
      ? `Chat AI configurat: fine-tuned (${OPENAI_MODEL.split(':').pop()}) + web search cu validare email`
      : 'Chat AI nu este configurat - verifică OPENAI_API_KEY',
  });
}
