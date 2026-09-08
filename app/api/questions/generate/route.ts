/**
 * POST /api/questions/generate
 *
 * Generates 10 strategic Law 544/2001 questions for one category, using the
 * problem context (CE / UNDE / CÂND) and the identified institution.
 * Called 5× in parallel (one per category) by useQuestionGeneration.
 *
 * Model: Claude Haiku 4.5 (same provider as the chat).
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const CATEGORY_CONFIG: Record<string, { label: string; description: string }> = {
  A_FINANCIAR: {
    label: 'A. Financiar',
    description: 'Buget, cheltuieli, contracte, achiziții publice, fonduri alocate',
  },
  B_RESPONSABILITATE: {
    label: 'B. Responsabilitate',
    description: 'Cine răspunde, proceduri interne, termene, persoane responsabile',
  },
  C_PLANIFICARE: {
    label: 'C. Planificare',
    description: 'Planuri de acțiune, buget viitor, calendar lucrări, proiecte aprobate',
  },
  D_MONITORIZARE: {
    label: 'D. Monitorizare',
    description: 'Sesizări similare primite, rezolvări anterioare, indicatori de performanță',
  },
  E_CONFORMITATE: {
    label: 'E. Conformitate',
    description: 'Norme și reglementări aplicabile, audituri, sancțiuni, inspecții',
  },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_CONFIG);

const SYSTEM_PROMPT =
  'Ești un expert juridic specializat în Legea 544/2001 privind liberul acces la informațiile de interes public din România. ' +
  'Generezi întrebări strategice pe care cetățenii le pot adresa instituțiilor publice. ' +
  'Răspunzi exclusiv în limba română.';

/** Cap free-text inputs so a malicious client cannot inflate the prompt */
function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

/** Extract numbered lines from the model output */
function parseQuestions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[\.\)]|[-•*])\s*/, '').trim())
    .filter((line) => line.length > 10 && !/^(întrebări|categoria)/i.test(line));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    let body: { category?: string; problemContext?: Record<string, unknown>; institutionName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 });
    }

    const { category, problemContext, institutionName } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Categorie invalidă. Categorii valide: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    const ce = clip(problemContext?.ce, 600);
    const unde = clip(problemContext?.unde, 300);
    const cand = clip(problemContext?.cand, 200);
    const institutie = clip(institutionName, 200);

    if (!ce || !unde) {
      return NextResponse.json(
        { error: 'problemContext.ce și problemContext.unde sunt obligatorii' },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[questions/generate] ANTHROPIC_API_KEY is not configured');
      return NextResponse.json(
        { category, questions: [], error: 'Serviciul de generare nu este configurat' },
        { status: 503 },
      );
    }

    const client = new Anthropic({ apiKey });
    const config = CATEGORY_CONFIG[category];

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1500,
      temperature: 0.5,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generează exact 10 întrebări strategice pentru categoria ${config.label} (${config.description}).

Context problemă:
- CE: ${ce}
- UNDE: ${unde}
- DE CÂND: ${cand || 'nespecificat'}
- INSTITUȚIE: ${institutie || 'nespecificată'}

Reguli:
1. Întrebările trebuie să fie concrete, legate de contextul specific al problemei descrise
2. Fiecare întrebare trebuie să ceară documente, date numerice sau fapte verificabile
3. NU folosi ton acuzator sau abstract
4. Fiecare întrebare trebuie formulată ca o solicitare formală conform Legii 544/2001
5. Întrebările trebuie să acopere aspecte diferite ale categoriei ${config.label}
6. Formulează întrebările la persoana I ("Vă rog să îmi furnizați...", "Solicit informații despre...")

Răspunde DOAR cu cele 10 întrebări, câte una pe linie, numerotate 1-10. Fără introducere, fără explicații suplimentare.`,
        },
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const questions = parseQuestions(responseText).slice(0, 10);

    if (questions.length === 0) {
      console.warn(`[questions/generate] Empty result for ${category}:`, responseText.slice(0, 200));
    }

    return NextResponse.json({ category, questions });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error('[questions/generate] Error:', err.message || error);

    // Surface auth/rate-limit problems instead of silently returning an empty list
    if (err.status === 401) {
      return NextResponse.json(
        { category: 'unknown', questions: [], error: 'Cheia Anthropic este invalidă' },
        { status: 502 },
      );
    }
    if (err.status === 429) {
      return NextResponse.json(
        { category: 'unknown', questions: [], error: 'Limită de rată atinsă. Reîncearcă în câteva secunde.' },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { category: 'unknown', questions: [], error: 'Eroare la generarea întrebărilor' },
      { status: 500 },
    );
  }
}
