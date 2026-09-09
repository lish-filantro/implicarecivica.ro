# Chat → wizard: transferul instituției și al întrebărilor

Data: 2026-09-09 · Modul: manager 544 · Stare: design aprobat, urmează planul de implementare

## 1. Problema

Chatul identifică problema (pasul 1), instituția și emailul ei (pasul 2), apoi generează 25 de
întrebări în conversație, categorie cu categorie (pasul 3). Wizardul de cereri (`/requests/new`)
are propriul generator de întrebări (Haiku), iar legătura dintre cele două e fragilă: butonul
"Da, e corect" apare doar pe ultimul mesaj, datele trec prin `sessionStorage` și se pierd la tab
nou, instituția și emailul se extrag cu regex din textul botului, iar utilizatorul reface la
pasul 1 al wizardului date pe care le are deja în profil.

## 2. Rezultatul dorit

După ce botul identifică instituția și emailul, utilizatorul vede un card clar cu un buton
"Pregătește cererile". Butonul deschide wizardul direct la selecția întrebărilor, cu datele
solicitantului și ale instituției precompletate și cu 25 de întrebări generate de Sonnet din
conversație, bifate. Chatul nu mai generează întrebări. Transferul se păstrează pe conversație,
în baza de date, și poate fi reluat oricând.

## 3. Decizii luate

| Subiect | Decizie |
|---|---|
| Unde se generează întrebările | În wizard, printr-un endpoint nou pe Sonnet; Haiku rămâne fallback |
| Context pentru generare | Toată conversația (transcript tăiat la o limită), nu doar CE/UNDE/CÂND |
| Număr de întrebări | 5 pe categorie, 25 în total, toate bifate implicit |
| Buton fără email | Dezactivat, cu îndrumare. Încredere scăzută nu blochează, doar avertizează |
| Denumire sesiune | Propusă automat din CE + instituție, editabilă |
| Persistență transfer | Coloană JSON `handoff` pe `conversations` |
| Chat după confirmare | Botul răspunde liber, cu guardrail post-confirmare; poate reidentifica instituția |
| `/requests/add` | Primește și el generare pe Sonnet, cu contextul sesiunii |

## 4. User stories

**US1 · Confirmare vizibilă a instituției.** Ca cetățean, după ce botul identifică instituția și
emailul, văd un card cu numele, emailul, pagina unde a fost găsit, nivelul de încredere și
butonul principal "Pregătește cererile".
Acceptare: cardul apare sub orice mesaj al botului care poartă instituția; aceeași acțiune apare
într-o bară fixă deasupra câmpului de scris câtă vreme transferul nu e confirmat; fără email
butonul e dezactivat și cardul explică ce poate face utilizatorul; la încredere scăzută butonul
e activ și cardul poartă avertisment.

**US2 · Corectarea instituției.** Ca cetățean, pot spune că instituția nu e corectă și continui
în chat ca să identific alta, fără să pierd contextul problemei.
Acceptare: "Nu e instituția corectă" trimite un mesaj în chat care declanșează reidentificarea;
un marker nou înlocuiește transferul neconfirmat.

**US3 · Salt peste pasul 1.** Ca cetățean cu profil complet, ajung direct la selecția
întrebărilor. Datele mele și ale instituției apar într-un sumar editabil.
Acceptare: pasul 1 nu se afișează; sumarul arată nume, email expeditor, adresă, instituție, email
instituție, denumire sesiune; "Modifică" deschide pasul 1 fără să piardă întrebările.

**US4 · Profil incomplet.** Ca cetățean fără adresă sau nume în profil, ajung la pasul 1 cu tot
ce se știe precompletat și doar câmpurile lipsă evidențiate.
Acceptare: după completare, "Continuă" duce la pasul 2 cu întrebările deja încărcate sau în curs
de încărcare.

**US5 · Întrebări preîncărcate din conversație.** Ca cetățean, la pasul 2 găsesc 5 întrebări pe
fiecare din cele 5 categorii, generate de Sonnet pe baza conversației, bifate implicit.
Acceptare: pot edita, debifa, adăuga; dacă generarea eșuează, văd mesaj și buton "Reîncearcă";
dacă și reîncercarea eșuează, wizardul cade pe generarea Haiku existentă, cu mesaj vizibil.

**US6 · Chat fără pasul 3.** Ca cetățean, după confirmare botul nu mai generează întrebări în
chat. Dacă scriu din nou, botul răspunde în limitele Legii 544 și mă trimite la wizard sau la
sesiunea deja creată.
Acceptare: promptul și guardrail-urile nu mai conțin pasul 3; testele de guardrail actualizate.

**US7 · Reluare.** Ca cetățean, dacă închid tab-ul după confirmare, redeschid conversația și
găsesc cardul și butonul la loc; wizardul deschis din nou nu regenerează întrebările.
Acceptare: transferul și întrebările se citesc din `conversations.handoff`.

**US8 · Trasabilitate.** Ca utilizator, sesiunea creată păstrează legătura cu conversația, iar
în chat văd că sesiunea există.
Acceptare: `request_sessions.conversation_id` setat (există deja); `handoff.sessionId` setat după
creare; cardul arată "Sesiune creată" cu link spre dashboard și buton "Cereri noi".

**US9 · Întrebări noi la o sesiune existentă.** Ca utilizator, în `/requests/add` pot genera
întrebări noi cu Sonnet, care țin cont de ce am trimis deja.
Acceptare: buton "Generează întrebări noi"; 5 pe categorie; instrucțiune explicită de a nu
repeta întrebările existente.

## 5. Arhitectură

### 5.1 Date

Migrare `018_conversation_handoff.sql`, idempotentă, rulată manual în Supabase:

```sql
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS handoff JSONB;
```

Forma obiectului (tip TypeScript `ConversationHandoff` în `shared/types/chat.ts`):

```ts
interface ConversationHandoff {
  institutionName: string;
  institutionEmail: string | null;
  emailConfidence: 'high' | 'medium' | 'low' | null;
  sourceUrl: string | null;
  problemContext: { ce: string; unde: string; cand: string };
  identifiedAt: string;          // ISO, la sosirea răspunsului cu marker
  confirmedAt: string | null;    // ISO, la apăsarea butonului
  sessionId: string | null;      // după crearea sesiunii
  questions: Record<QuestionCategory, string[]> | null; // cache generare
  questionsModel: string | null;
}
```

Scriere: client-side prin Supabase (RLS existent pe `conversations`), în trei momente:
la sosirea răspunsului cu instituția (`identifiedAt`), la apăsarea butonului (`confirmedAt`),
după crearea sesiunii (`sessionId`, din `useSendQueue`). Întrebările sunt scrise de endpoint-ul
de generare, server-side, cu clientul utilizatorului.

`current_step` păstrează valorile actuale; `STEP_3` înseamnă de acum "instituție confirmată".
`detectStepFromReply` nu mai caută `FINANCIAR`; `STEP_3` se scrie la confirmare.

### 5.2 API chat

`ChatResponseBody` primește `institution: { name, email, confidence, sourceUrl } | null`,
calculat în `post-process.ts` din markerul `INSTITUȚIE_IDENTIFICATĂ`, din `extractEmails` și din
scorul de încredere existent (`scoreEmailConfidence`), cu URL-ul sursei cu cel mai bun scor.
Extracția pe client (`useInstitutionExtraction`) dispare; clientul folosește obiectul primit.

Promptul:
- `system.ts`: secțiunea `STEP_3_ÎNTREBĂRI_STRATEGICE` e înlocuită cu `STEP_3_POST_CONFIRMARE`:
  întrebările se pregătesc în aplicație, nu în chat; botul răspunde la clarificări în limitele
  Legii 544, trimite la wizard; dacă utilizatorul contestă instituția, reia pasul 2.
- `step-guardrails.ts`: `STEP_3_GUARDRAIL` rescris în același sens.
- `steps.ts`: `hasCategoriaMarker` dispare; `STEP_3` se detectează din markerul instituției.

### 5.3 Generarea întrebărilor

`POST /api/questions/generate-set`, handler în `src/manager-544/questions/set-handler.ts`:

- Body: `{ conversationId } | { sessionId }`. Niciodată transcript de la client.
- Sursa contextului, încărcată server-side cu clientul utilizatorului (RLS):
  - `conversationId`: mesajele conversației, în ordine, tăiate la ~12 000 de caractere de la
    sfârșit; `handoff.institutionName`; CE/UNDE/CÂND din `handoff.problemContext`.
  - `sessionId`: instituția și întrebările deja trimise (`requests.request_body`); dacă sesiunea
    are `conversation_id`, și transcriptul acelei conversații.
- Un singur apel Sonnet (`CHAT_MODEL`) cu tool `emit_questions` cu schema strictă: 5 categorii,
  exact 5 întrebări fiecare. Parserul validează forma; lipsuri într-o categorie nu invalidează
  setul.
- Răspuns: `{ model, categories: Record<QuestionCategory, string[]> }`. Pentru `conversationId`
  rezultatul se scrie și în `handoff.questions`; dacă `handoff.questions` există deja, se
  întoarce din cache fără apel la model (`?refresh=1` forțează regenerarea).
- Erori: 401, 400 (body), 404 (conversație sau sesiune inexistentă), 429/502/500 mapate ca la
  endpoint-ul Haiku. Endpoint-ul Haiku rămâne neschimbat, ca fallback.

Prompt: sistemul existent din `questions/prompt.ts`, extins cu regulile din fostul pas 3 al
chatului (concrete, legate de CE+UNDE+CÂND, cer documente sau fapte, neacuzatoare, persoana I),
plus, pentru sesiuni, lista întrebărilor deja trimise și interdicția de a le repeta.

### 5.4 Chat UI

- `ChatScreen`: la fiecare răspuns cu `institution`, scrie `handoff` (neconfirmat) pe
  conversație. Butonul "Pregătește cererile": scrie `confirmedAt`, `current_step = STEP_3`,
  pornește `generate-set` (fire-and-forget) și navighează la `/requests/new?conversation=<id>`.
- `InstitutionCard` (componentă nouă) înlocuiește blocul de butoane din `MessageBubble`: nume,
  email, sursă, încredere, buton principal, "Nu e instituția corectă". Stări: fără email
  (buton dezactivat, text de îndrumare), încredere scăzută (avertisment), sesiune creată
  ("Sesiune creată", link dashboard, buton "Cereri noi" → `/requests/add?session=<id>`).
- `HandoffBar` (componentă nouă): bară fixă deasupra câmpului de scris când `handoff` există și
  `confirmedAt` e null; aceeași acțiune ca butonul din card.
- `useConversation` expune `handoff` (încărcat cu conversația) și `confirmHandoff()`.

### 5.5 Wizard

- Intrare: `/requests/new?conversation=<id>`. `useRequestWizard` primește `handoff` și profilul,
  apoi `decideStartStep(handoff, profile)`: pasul 2 dacă profilul are `display_name` și `address`
  și `handoff.institutionEmail` e valid; altfel pasul 1, cu câmpurile lipsă marcate.
- `sessionNameFrom(ce, institutionName)`: CE tăiat la 40 de caractere pe graniță de cuvânt,
  virgulă, numele instituției. Editabilă în pasul 1 și în sumar.
- `WizardSummaryCard` (componentă nouă) deasupra întrebărilor la pasul 2, cu "Modifică" →
  pasul 1; întrebările și selecția se păstrează.
- `useQuestionGeneration` primește o strategie: `generate-set` (implicit când există
  `conversationId` sau `sessionId`) cu fallback pe Haiku per categorie după o reîncercare eșuată.
  Stare per categorie ca acum, plus "Reîncearcă".
- `chat-transfer.ts`, `?from=chat` și `sessionStorage` dispar. `useSendQueue` scrie
  `handoff.sessionId` după crearea sesiunii.
- `/requests/add`: buton "Generează întrebări noi" care apelează `generate-set` cu `sessionId`.

### 5.6 Fluxul complet

1. Pasul 2 din chat livrează răspunsul cu marker; serverul întoarce `institution`.
2. Clientul scrie `handoff` neconfirmat; cardul și bara apar.
3. Utilizatorul apasă "Pregătește cererile": `confirmedAt`, `STEP_3`, pornește generarea,
   navighează.
4. Wizardul încarcă `handoff` și profilul, decide pasul de start, afișează întrebările pe măsură
   ce sosesc (sau din cache).
5. Trimiterea creează sesiunea cu `conversation_id`, apoi scrie `handoff.sessionId`.
6. Revenit în chat, utilizatorul vede "Sesiune creată"; botul răspunde în regim post-confirmare.

## 6. Tratarea erorilor

- Scrierea `handoff` eșuează: cardul apare oricum din răspunsul curent; la refresh dispare; log în
  consolă. Butonul funcționează și fără scriere, cu transferul din memorie, ca să nu blocăm.
- `generate-set` eșuează: o reîncercare manuală, apoi fallback Haiku, mesaj vizibil cu
  modelul folosit.
- Conversație fără `handoff` deschisă la `/requests/new?conversation=`: wizardul pornește la
  pasul 1 gol, cu notă "Conversația nu are o instituție confirmată".
- Email invalid sau lipsă în `handoff`: pasul 1, câmpul marcat.
- Regenerare după ce sesiunea există: `generate-set` cu `conversationId` întoarce cache-ul;
  întrebările noi se cer prin `/requests/add`.

## 7. Testare

- Unit: `extractInstitution` server-side (marker, email, încredere, sursă); `decideStartStep`;
  `sessionNameFrom`; parserul `emit_questions`; guardrail post-confirmare și detecția pașilor
  fără `CATEGORIA_`; citire/scriere `handoff` (queries cu client fals); `InstitutionCard` în
  toate stările; `useQuestionGeneration` cu strategie set + fallback.
- Route: `generate-set` cu client Anthropic fals: conversație, sesiune, cache, `refresh`, 404,
  erori mapate. Chat handler: `institution` prezent la pasul 2, null altfel.
- Playwright: `02-chat` se extinde cu apăsarea butonului, URL `/requests/new?conversation=`,
  "Selectează întrebările" vizibil, instituția în sumar, cel puțin o categorie cu întrebări în
  120 s. `03-request-lifecycle` rămâne pe intrarea manuală.

## 8. În afara scopului

Redesign vizual al chatului sau al wizardului dincolo de card, bară și sumar. Modificarea
limitelor zilnice. Editarea profilului din wizard (doar câmpurile existente). Campanii.

## 9. Riscuri

- Apelul Sonnet pentru 25 de întrebări durează probabil 15 până la 30 s; de aceea pornește
  înainte de navigare și rezultatul se salvează.
- Butonul blocat fără email depinde de capacitatea botului de a confirma o adresă dată de
  utilizator; regula "confirmată online" rămâne, deci un site fără adresă publicată lasă
  utilizatorul să completeze emailul manual doar în pasul 1 al wizardului, prin intrarea
  manuală.
- Migrarea 018 trebuie aplicată înainte de deploy; până atunci scrierea `handoff` eșuează
  silențios și fluxul cade pe comportamentul din secțiunea 6.
