# Refactor manager 544 — design

Stare: IMPLEMENTAT pe branch-ul `refactor/manager-544` (2026-09-08). Baseline: commit `31cf945` pe `main`. Plan: `2026-09-08-manager-544-refactor-plan.md`; îmbunătățiri propuse: `2026-09-08-manager-544-improvements.md`.

## 1. Scop

Reorganizăm codul managerului de cereri Legea 544 (chat, wizard cereri, trimitere/primire emailuri, OCR + clasificare, potrivire, statusuri, dashboard, admin) într-un subfolder modular, cu fișiere de maxim 200 de linii, teste pentru fiecare funcție și problemele din audit rezolvate. Comportamentul vizibil rămâne identic, cu excepția corecțiilor listate în §6.

Nu facem: refactor sau ștergere a modulului campanii; pagini publice (institutii, quiz, alegeri, despre); schimbări de design vizual; schimbări de prompturi AI (în afara categoriei „irelevant").

## 2. Structura țintă

```
src/manager-544/
  shared/
    db/            clients Supabase (server, browser, service), tipuri DB, repository-uri tipate
    auth/          getUser, requireUser, requireAdmin, requireCronSecret, requireWebhookSecret
    http/          json(), error(), parseBody(schema)   -- răspunsuri și validare uniforme
    env.ts         citire env cu validare la pornire (fail-fast, fără fallback la "placeholder")
    types/         Request, Email, Session, Profile, Feedback (mutate din lib/types)
    utils/         date (addDays, deadline), text (htmlToText, normalize), csv
  chat/
    guardrails/    step-detection, context-extraction, injection, off-topic  (din lib/guardrails.ts, 389 → 4 fișiere)
    prompt/        system prompt, tool instructions, tool definitions
    rag/           institutii-search, institutii-rag (deja existente, mutate)
    anthropic/     client, agentic loop (tool_use / pause_turn), response parser
    email-validation.ts, output-validation.ts
    handler.ts     POST /api/chat-haiku (orchestrare, < 100 linii)
  questions/
    generate.ts    prompt + parser + handler
  requests/
    sessions/      create, add-requests, queries (server + client)
    rate-limit/    countSentToday, checkDailyLimit (o singură implementare, folosită de toate rutele)
    email-template.ts
    utils/         requestUtils, sessionUtils (sparte pe temă: question extraction, deadlines, labels)
  inbound/
    webhook/       parse payload, R2 client, MIME parse, attachments, thread detection, user lookup
    campaign-adapter.ts  singura legătură cu lib/campanii (rutarea către campanii, neschimbată)
    resend/        webhook Resend cu verificare de semnătură svix
  pipeline/
    ocr.ts, analysis/ (prompt, parser, validate-registration, retry), matching/ (thread, registration, context), status/ (transitions, deadlines, mark-delayed)
    process-email.ts   orchestrarea unui email; batch.ts pentru cron
  emails/
    send.ts, attachments.ts, queries (client)
  admin/
    stats.ts, approval.ts
  ui/
    dashboard/, emails/, requests/, chat/, settings/, feedback/, admin/   -- componentele extrase din paginile mari
```

Rutele din `app/api/**/route.ts` devin adaptoare de 10-30 de linii: `export const POST = chatHandler`. Paginile din `app/(authenticated)/**` importă componentele din `src/manager-544/ui/**`. Alias tsconfig: `@m544/*` → `src/manager-544/*`.

Ce rămâne în `lib/` la final: doar ce folosesc paginile publice și campanii (`lib/institutii.ts`, `lib/campanii/**`, `lib/utils.ts`). `lib/gemini`, `lib/mistral/constants.ts` (instrucțiunile agentului se mută în `chat/prompt`), `scripts/` mor.

## 3. Reguli de cod (aplicate cu ESLint, nu doar convenție)

- `max-lines: 200` (fără linii goale și comentarii) pe `src/**`, `app/**`, `components/**`, `lib/**`. Excepții: `tests/**`, `data/**`, `supabase/**`, fișiere generate.
- Un fișier = o responsabilitate; funcțiile primesc dependențele (db, ocr, analyzer, clock, fetch) ca parametru cu valori implicite, ca să fie testabile fără `vi.mock` global.
- Fără `any` nou; fără `process.env` citit în afara `shared/env.ts`.
- ESLint flat config cu `eslint-config-next` + regulile de mai sus; `npm run lint` intră în `npm test`.

## 4. Strategia de testare

- **Unit (vitest, zero rețea):** fiecare funcție exportată din `src/manager-544/**` are un test. Supabase e înlocuit de un repository fals în memorie care implementează aceleași interfețe; Mistral/Anthropic/Resend/R2 sunt clienți injectați cu răspunsuri fixe (inclusiv erori 429/403/500). Țintă: rulează în sub 15 secunde.
- **Integrare reală (există):** OCR, clasificare pe cele 37 PDF-uri, matching pe DB. Rulate la finalul fiecărei faze.
- **E2E reală (există, 30 teste):** poartă obligatorie înainte de merge.
- **Contract tests pentru rute:** fiecare `route.ts` are un test care apelează handler-ul cu `NextRequest` construit manual și verifică statusul și forma răspunsului (401/400/429/200).
- Teste noi scrise ÎNAINTE de mutarea codului (TDD): testul descrie comportamentul actual, îl văd trecând pe codul vechi, apoi mut codul și îl văd trecând pe cel nou.

## 5. Strategia de migrare (strangler, rută cu rută)

Fiecare fază se termină cu: unit verde, tsc 0 erori, lint 0 erori, build ok, commit. E2E la finalul fazelor 3, 5 și 7.

1. **Fundație:** `shared/` (env, auth, http, db repos), ESLint, alias, `.worktrees/` în gitignore, migrarea 016 scrisă.
2. **Pipeline:** ocr, analysis, matching, status, process-email + cron. Aici intră corecțiile de corectitudine.
3. **Inbound:** webhook Cloudflare, adaptor campanii, webhook Resend cu semnătură. Corecțiile de securitate. Apoi E2E.
4. **Requests & emails:** sessions, rate-limit unic, send, attachments, questions.
5. **Chat:** guardrails sparte, prompt, anthropic loop, handler. Apoi E2E + test manual local STEP_1/2.
6. **UI:** paginile mari (dashboard 511, admin 465, emails 374, settings 364, PreviewModal 373, requests/add 254, feedback 260) sparte în componente sub 200 de linii; hooks (useConversation 275, useRequestWizard 261) sparte.
7. **Curățenie:** ștergere cod mort (RequestCard*, DashboardSkeleton, FeedbackWidget, lib/gemini, scripts/, cloudflare-worker-campanii, MISTRAL-SETUP.md, server.log din git, PLAN-e2e-tests.md actualizat), `.env.example` final, README de arhitectură. Apoi E2E, PR.

## 6. Probleme rezolvate în refactor (din audit)

Securitate API
- `CRON_SECRET` și `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` obligatorii: fără ele ruta răspunde 500 „misconfigured" și loghează, nu lasă accesul liber.
- Webhook Resend: rămâne doar pentru evenimentele de livrare ale emailurilor trimise (`email.delivered/bounced/complained`), cu verificare reală a semnăturii svix (`svix-id`, `svix-timestamp`, `svix-signature`, HMAC pe `RESEND_WEBHOOK_SECRET`). `email.received` e refuzat: primirea se face exclusiv prin Cloudflare Email Worker. (Decizie: Resend = trimitere, Cloudflare = primire, fiecare pe ruta ei DNS.)
- Rate limit zilnic aplicat în `emails/send` indiferent de `request_id`, și în `sessions/create` chiar când `institution_email` lipsește (pe `institution_name`).
- Middleware: profil inexistent = neaprobat.

Corectitudine pipeline
- Categorie nouă `irelevant` (email care nu e răspuns 544): salvat ca `completed`, fără potrivire, fără eroare, fără retry infinit. Cele 6 emailuri blocate se deblochează la prima rulare a cron-ului.
- Categorie nouă `redirectionat` (instituția a trimis cererea altei instituții): cererea rămâne deschisă cu status `received`, instituția competentă se salvează în `requests.redirected_to` și în rezumat; utilizatorul vede „redirecționat către X". Promptul de clasificare primește definiția categoriei și un exemplu.
- Potrivirea contextuală nu mai folosește subiectul fix ca dovadă; ordinea devine: thread → nr. înregistrare → expeditor = instituția cererii, cu preferință pentru cereri fără răspuns și cea mai veche; egalitate → nepotrivit + marcat pentru revizuire manuală (`emails.needs_review`).
- `pending → answered` direct e permis doar dacă emailul conține și nr. de înregistrare sau vine pe thread; altfel `received` + `needs_review`.
- `checkAndMarkDelayedRequests` cu interogare filtrată în DB, nu în memorie.

Migrări Supabase (fișier `016_refactor_hardening.sql`, îl rulezi tu)
- Înlocuirea politicilor INSERT permisive cu una singură per tabel care cere `approved = true`.
- Coloană `emails.needs_review boolean default false`, coloană `requests.redirected_to text`, extinderea CHECK-ului `emails.category` cu `irelevant` și `redirectionat`, index `requests(user_id, institution_email, date_sent)`, index `emails(user_id, processing_status)`.

Igienă repo: §5 faza 7.

## 7. Riscuri și cum le tratăm

- **Deploy cu secrete lipsă în Vercel**: webhook-ul și cron-ul răspund 500 și inbound-ul e respins de worker. Mitigare: PR-ul nu se face merge până nu confirmi că `CRON_SECRET`, `CLOUDFLARE_EMAIL_WEBHOOK_SECRET`, cheile R2, Anthropic și Mistral sunt setate. Checklist în PR.
- **Migrarea 016 nerulată**: codul NU poate fi deployat fără ea. Categoriile `irelevant`/`redirectionat` încalcă CHECK-ul vechi pe `emails.category`, iar `emails.needs_review` și `requests.redirected_to` nu există. Ordinea obligatorie: 1) rulezi 016 în SQL Editor, 2) merge + deploy. Migrarea e compatibilă cu codul vechi (coloane noi opționale, CHECK extins), deci poate fi rulată oricând înainte.
- **Regresii UI la spargerea paginilor**: componente extrase 1:1, fără schimbări de markup; verificare vizuală locală pe fiecare pagină.
- **Supabase gratuit auto-pauzat**: e2e eșuează fals; verific health înainte de a rula suita.

## 8. Decizii luate în review (2026-09-08)

1. Webhook Resend: rămâne doar pentru livrare (delivered/bounced/complained) cu semnătură svix; `email.received` refuzat. Resend = trimitere, Cloudflare = primire.
2. Redirecționare: categorie proprie `redirectionat`, cererea rămâne deschisă, instituția competentă salvată.
3. Branch-urile locale vechi `refactoring` și `campanii`: șterse.
4. Alias: `@m544/*`.
5. Design aprobat; implementarea urmează planul din `2026-09-08-manager-544-refactor-plan.md`.
