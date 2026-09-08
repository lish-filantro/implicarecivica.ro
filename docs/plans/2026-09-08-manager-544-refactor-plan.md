# Refactor manager 544 — plan de implementare

Design aprobat: `2026-09-08-manager-544-refactor-design.md`. Branch: `refactor/manager-544` (worktree `.worktrees/refactor-manager-544`).

Convenții pentru fiecare task:
1. Scrie testul (unit, în `tests/unit/m544/**`) care descrie comportamentul dorit. Rulează: trebuie să eșueze (roșu).
2. Implementează minimul în `src/manager-544/**`. Rulează: verde.
3. Dacă e mutare de cod existent: rută/pagină trece pe noul modul, vechiul fișier se șterge în același task.
4. `npx tsc --noEmit`, `npm run lint`, `npx vitest run tests/unit` verzi → commit cu mesajul indicat.
5. Fișier > 200 linii (fără goale/comentarii) = lint eșuat = task neterminat.

Comenzi de verificare: `npm run check` (= tsc + lint + unit), `npm run test:integration`, `npm run test:e2e`, `npm run build`.

---

## Faza 1 — Fundație

### 1.1 ESLint flat config + regula 200 linii
- Fișiere: `eslint.config.mjs`, `package.json` (scripts `lint`, `check`), `.eslintignore` nu (flat config folosește `ignores`).
- Reguli: `eslint-config-next/core-web-vitals`, `@typescript-eslint/no-explicit-any: warn` (error în `src/**`), `max-lines: ["error", {max: 200, skipBlankLines: true, skipComments: true}]` pe `src/**`, `app/**`, `components/**`, `lib/**`, `middleware.ts`; ignores: `tests/**`, `data/**`, `.next/**`, `.worktrees/**`, `node_modules/**`, `scripts/**` (până la ștergere în 7.x), `components/campanii/**`, `app/campanii/**`, `lib/campanii/**`, `app/api/campanii/**` (campanii în afara scopului).
- Test: `npm run lint` rulează și raportează exact fișierele > 200 linii din scopul 544 (lista din audit: 25). Nu blocăm încă build-ul; regula devine blocantă odată cu faza 7.
- Commit: `Add ESLint flat config with 200-line rule for manager-544 scope`

### 1.2 Alias `@m544/*` și scheletul `src/manager-544/`
- `tsconfig.json` paths `@m544/*` → `./src/manager-544/*`; `vitest.config.ts` alias identic.
- Foldere goale cu `README.md` de 3 linii fiecare (scop modul).
- Test: `tests/unit/m544/alias.test.ts` importă `@m544/shared/env` (task 1.3) — scris în 1.3.
- Commit: `Add @m544 path alias and module skeleton`

### 1.3 `shared/env.ts`
- Funcții: `getEnv(name, {required})`, `getSecret(name)` (refuză `""`, `"placeholder"`, `whsec_placeholder`), `getPublicEnv()`. Fără cache la import (testabil cu `process.env` mutat).
- Teste: required lipsă → aruncă `EnvError` cu numele; placeholder → aruncă; valoare ok → returnează; opțional lipsă → `undefined`.
- Commit: `Add fail-fast env access for manager-544`

### 1.4 `shared/http/`
- `json(data, status)`, `httpError(status, message, extra?)`, `parseJsonBody(request, zodSchema)` → `{ok, data} | {ok:false, response}`; `withErrorBoundary(handler)` care loghează și întoarce 500 uniform.
- Teste: body invalid → 400 cu mesaj; body non-JSON → 400; schema ok → data; handler care aruncă → 500 fără leak de stack.
- Commit: `Add shared HTTP helpers (json, errors, body parsing)`

### 1.5 `shared/db/`
- `clients.ts`: `createServerClient()` (cookies), `createBrowserClient()`, `createServiceClient()` — mutate din `lib/supabase/{server,client,service}.ts`; `lib/supabase/*` devin re-exporturi de o linie (compatibilitate până în faza 6, apoi șterse).
- `types.ts`: tipuri rânduri DB (Request, Email, Session, Profile, Feedback) mutate din `lib/types/*` cu re-export.
- `repos/`: interfețe + implementări Supabase: `RequestsRepo`, `EmailsRepo`, `SessionsRepo`, `ProfilesRepo`, `StorageRepo`. Fiecare < 120 linii.
- `testing/fake-repos.ts` (în `tests/unit/m544/_fakes/`): implementări în memorie ale interfețelor, cu helpers `seed*`.
- Teste: pentru fiecare repo real, un test de contract care rulează doar dacă `RUN_DB_TESTS=1` (folosește Supabase real, user de test); fake-urile sunt testate cu aceleași cazuri (același fișier de test parametrizat).
- Commit: `Add typed repositories over Supabase with in-memory fakes`

### 1.6 `shared/auth/`
- `requireUser(request)` → `{user, supabase} | Response 401`; `requireAdmin()` (din `lib/admin/auth.ts`, cu `ADMIN_EMAILS` obligatoriu în prod, default doar în dev); `requireCronSecret(request)`; `requireWebhookSecret(request, envName)`. Secrete lipsă → 500 „misconfigured", nu acces liber.
- Teste: header corect → ok; greșit → 401; env lipsă → 500; placeholder → 500.
- Commit: `Add auth guards: user, admin, cron secret, webhook secret`

### 1.7 Migrarea `016_refactor_hardening.sql`
- Drop politici INSERT permisive pe requests, conversations, messages, request_sessions, feedback; creează câte una cu `auth.uid() = user_id AND approved`. `emails.needs_review`, `requests.redirected_to`, CHECK `emails.category` extins (`irelevant`, `redirectionat`), indexuri.
- Test: fișierul se parsează (test de sintaxă cu `pgsql-parser`? nu adăugăm dependență) → doar review manual + instrucțiuni în `supabase/migrations/README.md`.
- Commit: `Add migration 016: approved-only inserts, needs_review, redirect category`

Verificare fază: `npm run check`, `npm run build`.

---

## Faza 2 — Pipeline

### 2.1 `pipeline/ocr.ts`
- Mută `runOcrFromBytes/runOcrFromUrl`; clientul Mistral injectat (`deps.mistral`). Elimină `runOcrFromUrl` dacă nu e folosit (grep).
- Teste: pagini → markdown concatenat; 0 pagini → `''` și pages 0; eroare client → propagată.
- Commit: `Move OCR service to pipeline/ocr with injected client`

### 2.2 `pipeline/analysis/`
- `prompt.ts` (system prompt + definițiile `irelevant`, `redirectionat`), `parse.ts` (JSON strict sau bloc ```json, validare categorie, answer_summary), `registration.ts` (`validateRegistrationNumber`), `retry.ts` (`withRetry` 429/5xx), `analyze.ts` (orchestrare, model din env).
- Teste: fiecare parser cu exemple reale din `tests/snapshots/classification-golden.json`; categorie `null` → `irelevant` (nu eroare); `redirectionat` cu `redirected_to`; retry: 429×2 apoi 200 → ok, 429×4 → aruncă; 403 → nu reîncearcă.
- Commit: `Split analysis service; add irelevant and redirectionat categories`

### 2.3 `pipeline/matching/`
- `thread.ts`, `registration.ts` (exact, fuzzy, core), `context.ts` (expeditor = instituție, sent-to; fără subiect fix; preferă cea mai veche cerere fără răspuns; egalitate → null + `needsReview`), `match.ts` (ordinea).
- Teste: cu fake repos: fiecare strategie izolat; 2 cereri active către aceeași instituție + email fără thread/nr → null + needsReview; subiectul fix nu produce match.
- Commit: `Split matching into strategies; stop matching on fixed subject`

### 2.4 `pipeline/status/`
- `transitions.ts` (tabel pur: (status, categorie, hasRegNr, viaThread) → schimbări), `deadlines.ts` (`addDays`, 10/30 zile), `apply.ts` (citește cererea, aplică, leagă emailul), `mark-delayed.ts` (query filtrată `deadline < now`).
- Teste: tabelul de tranziții complet (toate combinațiile), inclusiv `pending`+`raspunse` fără nr → `received`+needsReview; `answered` nu se degradează; `redirectionat` → `received` + `redirected_to`.
- Commit: `Split status updater into pure transition table and appliers`

### 2.5 `pipeline/process-email.ts` + `pipeline/batch.ts`
- Orchestrare cu deps injectate; retry_count/failed; `irelevant` → completed fără match.
- Rutele `api/emails/process`, `api/cron/process-emails`, `api/cron/check-deadlines` devin adaptoare cu `requireCronSecret`.
- Teste: flux complet pe fake-uri pentru fiecare categorie; eroare OCR nu oprește analiza; eroare analiză → retry_count+1; a 3-a → failed.
- Commit: `Move email processing orchestration to pipeline with cron guards`

Verificare fază: `npm run check`, `npm run test:integration` (matching + classification pe cache).

---

## Faza 3 — Inbound

### 3.1 `inbound/webhook/`
- `payload.ts` (zod pentru payload-ul worker-ului), `addresses.ts` (`extractEmail`, `extractName`), `r2.ts` (fetch/delete, client injectat), `mime.ts` (postal-mime → body + attachments), `attachments.ts` (upload storage, 50MB), `thread.ts` (`detectParentEmail`), `user-lookup.ts`.
- Teste: fiecare cu fixture-uri mici (un .eml de test în `tests/fixtures/`).
- Commit: `Split Cloudflare inbound webhook into parsing, R2, MIME, storage`

### 3.2 `inbound/campaign-adapter.ts` + `inbound/handler.ts`
- Adaptorul apelează `lib/campanii/participation-queries` și inserarea în `campaign_messages` exact ca acum; handler-ul: `requireWebhookSecret` → campanii? → user flow → `after()` procesare.
- Teste: secret lipsă → 500; greșit → 401; campanie match → adaptor apelat, R2 neatins; user necunoscut → `{matched:false}`; duplicat → `{duplicate:true}`.
- Commit: `Move Cloudflare webhook to inbound handler with mandatory secret`

### 3.3 `inbound/resend/`
- `signature.ts` (verificare svix HMAC-SHA256 cu toleranță 5 min), `handler.ts` (doar delivered/bounced/complained; `email.received` → 400).
- Teste: semnătură validă/invalidă/expirată; received refuzat; delivered actualizează statusul emailului trimis.
- Commit: `Resend webhook: verify svix signature, delivery events only`

Verificare fază: `npm run check`, `npm run test:e2e`.

---

## Faza 4 — Requests & emails

### 4.1 `requests/rate-limit/` — o implementare (`countSentToday(userId, institutionEmail|Name)`, `assertDailyLimit`), folosită de `sessions/create`, `sessions/add-requests`, `emails/send`, `rate-limit/check`.
### 4.2 `requests/sessions/` — `create.ts`, `add-requests.ts`, `queries.server.ts`, `queries.client.ts` (mutate din `lib/supabase/session-queries.ts`).
### 4.3 `requests/utils/` — `question-extraction.ts`, `deadlines.ts`, `labels.ts`, `session-stats.ts` (din `requestUtils.ts` 281 + `sessionUtils.ts`).
### 4.4 `emails/` — `send.ts` (Resend injectat, rate limit obligatoriu), `attachments.ts` (signed URL, path prefix check), `queries.client.ts`.
### 4.5 `questions/generate.ts` — Anthropic injectat; parser testat cu răspunsuri reale salvate.
- Teste pentru fiecare; contract tests pentru cele 7 rute.
- Commit per subtask: `Move <x> to manager-544/<module>`.

---

## Faza 5 — Chat

### 5.1 `chat/guardrails/` — `steps.ts` (detect + validate), `context.ts` (extract CE/UNDE/CÂND/localitate), `injection.ts`, `off-topic.ts`. Testele existente din `lib/guardrails` (dacă există) + cazuri noi din log-urile reale.
### 5.2 `chat/prompt/` — `system.ts` (instrucțiunile agentului, mutate din `lib/mistral/constants.ts`), `tools.ts` (rag_search + web_search), `step-guardrails.ts`.
### 5.3 `chat/anthropic/` — `client.ts`, `messages.ts` (normalizare alternanță user/assistant), `loop.ts` (tool_use/pause_turn, max 8), `parse.ts` (text, citations, web results).
### 5.4 `chat/handler.ts` — < 100 linii; `requireUser`; validare email găsit; output validation.
- Teste: loop cu client fals (tool_use → rag → răspuns final); pause_turn; MAX_ITERATIONS; parse cu blocuri reale (salvate din testul local de azi).
- Verificare: `npm run check`, test manual local STEP_1/STEP_2 (script `scripts/dev/chat-smoke.mjs`, nou, în scop), e2e.

---

## Faza 6 — UI

Pentru fiecare pagină > 200 linii: componente extrase 1:1 în `src/manager-544/ui/<feature>/`, pagina rămâne containerul de date.
- 6.1 dashboard (511): `useDashboardData`, `DashboardAlerts`, `KpiGrid`, `SessionFilters`, `SessionList`.
- 6.2 admin/dashboard (465): `useAdminStats`, `PendingUsersTable`, `SignupsChart`, `StatusDistribution`, `TopInstitutions`.
- 6.3 emails (374): `useEmails` (load + realtime + mark read), `EmailDetail`, `EmailAttachments`, `MobileFolderBar`.
- 6.4 settings (364): `ProfileSection`, `NotificationsSection`, `SecuritySection`, `useProfileSettings`.
- 6.5 PreviewModal (373): `useSendQueue` (30 s delay, progres), `RateLimitNotice`, `SendProgress`.
- 6.6 requests/add (254), feedback (260), verify (202), StepFormData (202), SessionCard (234), RequestCard (210 → șters în 7), FeedbackWidget (214 → șters în 7).
- 6.7 hooks: `useConversation` (275) → `useConversation` + `useChatApi` + `useInstitutionExtraction`; `useRequestWizard` (261) → `useWizardForm` + `useWizardQuestions`.
- Teste: hooks cu `@testing-library/react` (adăugat ca devDependency) și fetch fals; componentele pure cu render smoke test.
- Commit per pagină.

---

## Faza 7 — Curățenie și finalizare

- 7.1 Șterge: `components/dashboard/RequestCard*.tsx`, `DashboardSkeleton`, `FeedbackWidget`, `lib/gemini/`, `lib/rag/vector-store` (deja), `scripts/*` (păstrează `process_alegeri.py`, mută în `tools/`), `cloudflare-worker-campanii/` (după confirmare că nu e deployat), `MISTRAL-SETUP.md`, `server.log` (+ `.gitignore`), `PLAN-e2e-tests.md` → `docs/testing.md` actualizat.
- 7.2 `lib/*` rămase: doar `institutii.ts`, `institutii-search.ts`, `utils.ts`, `campanii/**`; re-exporturile temporare șterse; `components/*` doar `ui/`, `shared/`, `campanii/`.
- 7.3 `max-lines` devine blocantă în `npm run build` (prebuild lint).
- 7.4 `README.md` (nou): arhitectură, module, cum rulezi testele, env-uri obligatorii, checklist deploy.
- 7.5 Verificare finală: `npm run check`, `test:integration`, `test:e2e`, `build`, smoke chat local.
- 7.6 PR pe GitHub către `main` cu checklist-ul de deploy (secrete Vercel, migrarea 016 rulată).

---

## Sugestii de îmbunătățire (livrate la final, în afara scopului refactorului)
Se colectează pe parcurs în `docs/plans/2026-09-08-manager-544-improvements.md`: notificări email la termene, revizuire manuală a potrivirilor (`needs_review` UI), Supabase auto-pause, RAG semantic dacă corpusul crește, observabilitate (Sentry/log drain), rate limit pe chat, PWA/mobile, etc.
