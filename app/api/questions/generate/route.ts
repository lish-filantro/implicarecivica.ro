import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

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

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const { category, problemContext, institutionName } = await request.json();

    // Validate inputs
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Categorie invalidă. Categorii valide: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!problemContext?.ce || !problemContext?.unde) {
      return NextResponse.json(
        { error: 'problemContext.ce și problemContext.unde sunt obligatorii' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { category, questions: [] },
        { status: 200 },
      );
    }

    const client = new OpenAI({ apiKey });
    const config = CATEGORY_CONFIG[category];

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `Ești un expert juridic specializat în Legea 544/2001 privind liberul acces la informațiile de interes public din România. Generezi întrebări strategice pe care cetățenii le pot adresa instituțiilor publice.`,
        },
        {
          role: 'user',
          content: `Generează exact 10 întrebări strategice pentru categoria ${config.label} (${config.description}).

Context problemă:
- CE: ${problemContext.ce}
- UNDE: ${problemContext.unde}
- DE CÂND: ${problemContext.cand || 'nespecificat'}
- INSTITUȚIE: ${institutionName || 'nespecificată'}

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

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse the 10 questions from the response
    const questions = responseText
      .split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 10);

    return NextResponse.json({
      category,
      questions: questions.slice(0, 10),
    });
  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { category: 'unknown', questions: [] },
      { status: 200 },
    );
  }
}
