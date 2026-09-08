/**
 * Tool usage instructions appended to the system prompt: when to call
 * rag_search vs web_search, and the single-answer STEP_2 flow. Verbatim from
 * the legacy route (app/api/chat-haiku/route.ts).
 */
export const TOOL_INSTRUCTIONS = `

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
