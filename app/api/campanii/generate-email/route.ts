import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyAdminSession } from "@/lib/campanii/admin-auth";
import { TEMPLATE_VARIABLES } from "@/lib/campanii/template-variables";

const anthropic = new Anthropic();

const VARIABLE_DOCS = TEMPLATE_VARIABLES.map(
  (v) => `  - ${v.tag} — ${v.description} (ex: "${v.sampleValue}")`
).join("\n");

function buildSystemPrompt(tone: string) {
  return `Ești un specialist în advocacy civic din România. Generezi emailuri de campanie pentru petiții și solicitări civice.

REGULI:
1. Scrie în limba română, corect gramatical.
2. Folosește variabile de template acolo unde e relevant:
${VARIABLE_DOCS}
3. Variabila {nume_participant} TREBUIE folosită cel puțin o dată (în semnătură sau corp).
4. Emailul trebuie să fie:
   - Respectuos dar ferm
   - Cu argumente concrete
   - Cu o cerere clară de acțiune
   - Lungime: 150-400 cuvinte
5. NU inventa legi, articole sau numere. Fii factual.
6. Returnează DOAR JSON valid: { "subject": "...", "body": "..." }
   - "body" include totul: formulă de adresare, corp, cereri, semnătură
   - NU include subiectul în body

Ton "${tone}":
${
  tone === "formal"
    ? "- Limbaj instituțional, formula Dumneavoastră/Dvs., formule standard de adresare"
    : tone === "empatic"
    ? '- Ton personal, conectare emoțională, perspectiva "noi cetățenii", apel la valori comune'
    : '- Ton direct, sublinierea urgenței situației, termene limită, consecințe ale inacțiunii'
}`;
}

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  try {
    const {
      causeDescription,
      recipientContext,
      tone = "formal",
      keyPoints = [],
      existingSubject,
      existingBody,
    } = await req.json();

    if (!causeDescription?.trim()) {
      return NextResponse.json(
        { error: "Descrierea cauzei e obligatorie" },
        { status: 400 }
      );
    }

    const keyPointsText =
      keyPoints.length > 0
        ? `\nPuncte cheie de abordat:\n${keyPoints.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}`
        : "";

    const refinement =
      existingBody?.trim()
        ? `\nEmailul curent (de îmbunătățit):\nSubiect: ${existingSubject || "(lipsă)"}\nCorp:\n${existingBody}`
        : "";

    const userPrompt = `Cauza: ${causeDescription}
Destinatari: ${recipientContext || "nespecificat"}${keyPointsText}${refinement}

${existingBody?.trim() ? "Îmbunătățește emailul de mai sus păstrând ideile principale." : "Generează un email complet pentru această cauză."}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: buildSystemPrompt(tone),
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Răspuns gol de la AI" },
        { status: 500 }
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);

    return NextResponse.json({
      subject: parsed.subject || "",
      body: parsed.body || "",
    });
  } catch (error) {
    console.error("Generate email error:", error);
    return NextResponse.json(
      { error: "Eroare la generarea emailului" },
      { status: 500 }
    );
  }
}
