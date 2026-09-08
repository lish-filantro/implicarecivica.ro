# Manager 544 — implementarea îmbunătățirilor (design)

Status: aprobat de utilizator pe 2026-09-08 („implementeaza aceste sugestii, mergem pe haiku"). Continuă pe branch-ul `refactor/manager-544`, după refactorul din aceeași zi. Regulile rămân: fișiere TS/TSX ≤ 200 linii, fără `any`, dependențe injectate, un test per fișier sursă, `process.env` doar prin `shared/env`.

Decizii ale utilizatorului: clasificarea trece pe **Claude Haiku** (un singur furnizor AI pentru text; OCR rămâne Mistral). Modulul campanii rămâne neatins (sugestia 14 nu se implementează). Sugestia 3 (plan plătit Supabase) și partea de log-drain din 5 sunt configurări externe, nu cod.

## Pachete de lucru (WP) și proprietatea fișierelor

Fiecare WP e implementat de un subagent care atinge DOAR fișierele listate la el (plus testele-oglindă din `tests/unit/m544/**`). Fișierele comune (`vercel.json`, migrarea 017, `.env.example`, `README.md`, `eslint.config.mjs`) sunt scrise de lead.

### WP-A — Clasificare pe Haiku (sugestia 6)

Fișiere: `src/manager-544/pipeline/analysis/**`, `tests/unit/m544/pipeline/analysis/**`, `tests/integration/classification*.test.ts`.

- Interfață neutră față de furnizor în `analysis/client.ts`:
  ```ts
  export interface AnalysisClient { complete(system: string, user: string): Promise<string>; }
  ```
- `analysis/providers/anthropic.ts`: `createAnthropicAnalysisClient()` peste `@anthropic-ai/sdk` (`claude-haiku-4-5-20251001`, `max_tokens: 2048`, `temperature: 0.1`, system + un mesaj user; răspunsul = concatenarea blocurilor `text`). Fără JSON mode: promptul cere JSON strict, `parseAnalysisJson` acceptă și blocuri ```json.
- `analysis/providers/mistral.ts`: adaptorul actual (JSON mode), păstrat ca alternativă.
- `analyze.ts` alege furnizorul: `ANALYSIS_PROVIDER` = `anthropic` (implicit) | `mistral`. `ANALYSIS_MODEL` opțional suprascrie modelul furnizorului; `MISTRAL_ANALYSIS_MODEL` rămâne acceptat pentru compatibilitate. Cheia lipsă → `EnvError` (500 misconfigured), nu fallback tacit.
- Promptul: adaugă o linie „Răspunde DOAR cu obiectul JSON, fără text înainte sau după" (Haiku tinde să explice).
- Testele de integrare pe cele 37 PDF-uri rulează pe furnizorul din env și scriu snapshot-ul în `tests/snapshots/classification-golden.<provider>.json`; testul compară cu golden-ul furnizorului curent. Lead-ul rulează integrarea pe Haiku și raportează scorul față de 56/58 (ministral).

### WP-B — Termene în zile lucrătoare (sugestia 8)

Fișiere: `src/manager-544/shared/utils/{holidays,business-days}.ts`, `src/manager-544/pipeline/status/deadlines.ts`, `src/manager-544/requests/utils/deadlines.ts`, testele lor, `tests/e2e/**` și `tests/integration/matching*.test.ts` acolo unde verifică termene.

- Bază legală: Legea 544/2001 art. 7 + Normele metodologice (HG 123/2002, modificate prin HG 478/2016) art. 16: 10 zile **lucrătoare** pentru răspuns, 30 zile lucrătoare când se prelungește, 5 zile lucrătoare pentru refuz. Toate de la data înregistrării.
- `holidays.ts`: `romanianPublicHolidays(year): string[]` (YYYY-MM-DD): 1–2 ian, 6 ian, 7 ian, 24 ian, Vinerea Mare, Paște ortodox + a doua zi, 1 mai, 1 iun, Rusalii + a doua zi (Paște + 49/50), 15 aug, 30 nov, 1 dec, 25–26 dec. Paștele ortodox prin algoritmul Meeus (calendar iulian) + 13 zile. `isPublicHoliday(date)`, `isBusinessDay(date)` (nu weekend, nu sărbătoare). Calculul în ora locală a României nu contează: lucrăm pe componenta de dată UTC a ISO-ului.
- `business-days.ts`: `addBusinessDays(dateIso, n): string` — pornește de la ziua următoare, numără doar zile lucrătoare, păstrează ora din ISO-ul de intrare; `businessDaysBetween(a, b)`.
- `pipeline/status/deadlines.ts`: `STANDARD_DEADLINE_DAYS = 10`, `EXTENDED_DEADLINE_DAYS = 30`, `REFUSAL_DEADLINE_DAYS = 5`, toate lucrătoare; `standardDeadline`/`extendedDeadline` folosesc `addBusinessDays`. `EXTENSION_EXTRA_DAYS` dispare; `extension_days` salvat = 30 (câte zile lucrătoare are în total instituția).
- `requests/utils/deadlines.ts`: `getDaysUntilDeadline` rămâne calendaristic (așa se citește pe ecran), dar adaugă `getBusinessDaysUntilDeadline`. Etichetele care spuneau „30 de zile" (`app/page.tsx` linia cu „termenul legal de 30 de zile") devin „10 zile lucrătoare" — WP-B are voie la acea linie.

### WP-C — Revizuire manuală + feedback pe clasificare (sugestiile 1 și 7)

Fișiere: `src/manager-544/emails/review/**`, `src/manager-544/ui/emails/**`, `src/manager-544/requests/queries.client.ts` (nou), `app/api/emails/[id]/review/route.ts`, `app/(authenticated)/emails/page.tsx` dacă e nevoie.

- API `POST /api/emails/{id}/review`, body zod:
  ```ts
  { action: 'assign', request_id: uuid } | { action: 'reclassify', category: EmailCategory, note?: string } | { action: 'dismiss' }
  ```
  Autentificat cu `requireUser`; toate scrierile prin clientul de sesiune (RLS = proprietate). Email inexistent/al altcuiva → 404.
  - `assign`: leagă emailul de cerere și re-aplică tranziția cu analiza salvată în `ai_extracted_data.analysis` prin `applyStatusUpdate` (importat din `@m544/pipeline/status`, `viaThread: false`); `needs_review = false`.
  - `reclassify`: scrie `category` nouă, inserează în `classification_feedback` (vezi migrarea 017), `needs_review = false`; dacă emailul are `request_id`, re-aplică tranziția cu analiza salvată dar categoria corectată. Categoria `irelevant` dezleagă emailul de cerere (`request_id = null`).
  - `dismiss`: `needs_review = false`.
  Răspuns: `{ success: true, email }`.
- Serviciu pur `emails/review/service.ts` (`reviewEmail(input, deps)`), repo `emails/review/repo.ts` (`SupabaseReviewRepo`: getOwnedEmail, insertFeedback), handler `emails/review/handler.ts` (`createReviewEmailHandler(getDeps)`), `deps.ts`.
- UI: folder nou `review` în `filter.ts` (`needs_review === true`), contor în sidebar/mobile bar, banner „Necesită revizuire" în `EmailDetail` cu `ReviewPanel` (select cererile deschise ale utilizatorului din `requests/queries.client.ts` → `listOpenRequests()`, butoane Asociază / Marchează ca revizuit), meniu „Clasificarea e greșită" (`ReclassifyMenu`) disponibil pe orice email primit. Hook `useReview` cu `fetch` injectabil; după succes actualizează emailul în listă (via `onUpdated(email)` din `useEmails`).

### WP-D — Notificări la termene (sugestia 2)

Fișiere: `src/manager-544/notifications/**`, `app/api/cron/notify-deadlines/route.ts`.

- `notifications/select.ts` (pur): `selectNotifications(requests, profile, today)` → pentru un utilizator, cererile deschise cu termen efectiv în ≤ `notification_deadline_days` zile (kind `upcoming`) și cele depășite/`delayed` (kind `overdue`).
- `notifications/template.ts` (pur): subiect + HTML în română, listă cu instituție, subiect, termen, zile rămase; link către `/dashboard`.
- `notifications/repo.ts`: `NotificationsRepo` cu `listOptedInUsers()` (profiles.notification_email = true; emailul de login prin `auth.admin.getUserById`), `listOpenRequests(userId)`, `alreadySent(userId, requestId, kind, dateIso)` / `markSent(...)` pe tabela `deadline_notifications` (o notificare per cerere, per kind, per zi).
- `notifications/digest.ts`: `sendDeadlineDigests(deps)` — pentru fiecare utilizator: selectează, filtrează deja-trimise, un singur email prin `EmailSender` (același tip ca la `emails/send`), de la `notificari@<NEXT_PUBLIC_EMAIL_DOMAIN>`; returnează `{ users, emails_sent, skipped }`. Erorile per utilizator se loghează și nu opresc bucla.
- Handler `createNotifyDeadlinesHandler(getDeps)` cu `requireCronSecret`. Cron Vercel `0 6 * * *` (după `check-deadlines` la 02:00).

### WP-E — Inbound fiabil + observabilitate (sugestiile 4 și 5)

Fișiere: `cloudflare-email-worker/**`, `src/manager-544/inbound/**` (fără `resend/`), `src/manager-544/shared/log.ts`, `src/manager-544/admin/{stats,supabase-repos}.ts`, `app/api/cron/reconcile-inbound/route.ts`.

- Worker: după ce `EMAIL_BUCKET.put` reușește, emailul este **acceptat întotdeauna** (nu mai există `setReject` pentru erori API). Metadatele complete (from, to, subject, message_id, in_reply_to, references trunchiat la 1000 caractere, received_at) se salvează în `customMetadata` ca să poată fi reconstruit payload-ul. `setReject` rămâne doar când R2 însuși eșuează (atunci instituția primește bounce și retrimite).
- `inbound/ingest.ts`: `ingestEnvelope(env, deps)` = logica din `handler.ts` (campanie / utilizator), returnând un obiect rezultat, nu `NextResponse`; `handler.ts` devine subțire. Raw-ul din R2 se șterge numai după inserare reușită sau duplicat.
- `inbound/reconcile/{r2-list,reconcile,handler}.ts`: `GET /api/cron/reconcile-inbound` (CRON_SECRET, la fiecare 6 ore): listează `inbound/` în R2 (ListObjectsV2 + HEAD pentru metadate, prin `aws4fetch`), ignoră obiectele mai noi de 10 minute (în curs), reconstruiește envelope-ul și rulează `ingestEnvelope`; obiectele fără metadate suficiente sau mai vechi de 7 zile sunt raportate, nu șterse. Rezumat `{ scanned, ingested, duplicates, skipped, errors }`.
- `shared/log.ts`: `log.info/warn/error(event, fields?)` — JSON pe o linie în producție (Vercel log drain-ready), text lizibil în dev. Pipeline-ul și inbound-ul îl folosesc pentru evenimentele importante (`email.ingested`, `email.processed`, `email.failed`, `inbound.reconciled`).
- Admin stats: `emails_pending`, `emails_failed`, `emails_needs_review`, `last_inbound_at` în `/api/admin/stats` și carduri pe dashboard-ul admin (`app/admin/dashboard/page.tsx` — WP-E are voie).

### WP-F — Chat: instituții locale, sector, limită (sugestiile 9, 10, 11)

Fișiere: `src/manager-544/chat/**`, `src/manager-544/shared/db/institutions-repo.ts`, `src/manager-544/pipeline/{process-email,deps,types}.ts`, `tests/unit/m544/_fakes/fake-institutions-repo.ts`.

- `extractLocalitate`: acceptă cifre și „Sector N": „Str. X, București, Sector 3" → `București`; „Sector 3, București" → `București`; „Bd. Y nr. 12, Pitești, Argeș" → `Pitești` (nu se strică).
- `institutii_locale` (migrarea 017): `InstitutionsRepo { recordVerifiedEmail({ name, email, source }) ; findByName(name, limit) }`. Pipeline: după o potrivire reușită (categorie ≠ `irelevant`), `process-email.ts` cheamă `deps.institutions?.recordVerifiedEmail({ name: request.institution_name, email: expeditorul instituției, source: 'raspuns' })` — opțional în `ProcessDeps`, erorile doar se loghează. Numele normalizat = lower, fără diacritice, spații comprimate.
- Chat: `createRagSearchExecutor` primește și `knownEmails?: (name: string) => Promise<KnownInstitution[]>`; pentru fiecare rezultat RAG cu nume instanțiat caută în `institutii_locale` și adaugă `email_verificat` + `verificat_la`; instrucțiunea din prompt-ul STEP_2 spune: dacă `email_verificat` există, folosește-l fără `web_search`. `ChatDeps` primește `institutions?: InstitutionsRepo` (clientul de serviciu, doar citire).
- `chat/rate-limit.ts`: `CHAT_DAILY_LIMIT = 60` mesaje/utilizator/zi. `ChatUsageCounter { countToday(userId, now): Promise<number> }`, implementare Supabase pe `messages` (join `conversations!inner(user_id)`, `sender = 'user'`, `created_at >= începutul zilei UTC`). Handler: 429 `{ error, limit, used }` înainte de a apela modelul.

### WP-G — Date deschise + pagini publice sub 200 linii (sugestiile 12 și 13)

Fișiere: `src/manager-544/public-stats/**`, `app/api/public/institutii-stats/route.ts`, `app/page.tsx`, `app/institutii/[slug]/**`, `components/public/**` (nou), `lib/institutii.ts` → `lib/institutii/**`, `eslint.config.mjs` (doar scoaterea celor trei căi din `OUT_OF_SCOPE`).

- `GET /api/public/institutii-stats?nume=<nume_scurt>`: public, fără auth, `revalidate` 1h. Repo cu clientul de serviciu: cererile cu `institution_name ilike %nume%` sau `institution_id = slug`, doar coloanele `status, date_sent, date_received, response_received_date, deadline_date, extension_date`. Agregare pură (`aggregate.ts`): `total, answered, delayed, extension, median_days_to_answer, answered_within_deadline_pct`. Sub 3 cereri → `{ total: <n>, insufficient: true }` (fără alte cifre; anonimizare).
- `components/public/InstitutionStats.tsx` (client, fetch la runtime, nu randează nimic la eroare) inclus pe pagina instituției.
- Spargere: `app/page.tsx` → `components/public/home/{Hero,HowItWorks,Features,Cta}.tsx`; `app/institutii/[slug]/page.tsx` → `components/public/institutie/{Header,Atributii,Procedura,Cazuri,Related}.tsx`; `lib/institutii.ts` → `lib/institutii/{types,load,domenii,cazuri,search-index}.ts` + `lib/institutii.ts` barrel de re-export (importurile existente rămân valabile). Comportament identic (snapshot HTML înainte/după prin test de randare).

## Migrarea 017 (lead)

```sql
classification_feedback(id, email_id, user_id, previous_category, new_category, note, created_at)  -- RLS: owner insert/select
deadline_notifications(user_id, request_id, kind, sent_on date, PK(user_id, request_id, kind, sent_on))  -- service role only
institutii_locale(id, nume_normalizat unique, nume, email, judet, localitate, sursa, verificat_la, nr_confirmari) -- service role only
```

## Ordinea și poarta

1. Lead: design, migrarea 017, `vercel.json` (2 cron-uri noi), commit.
2. WP-A…G în paralel (subagenți), fiecare cu TDD și poarta locală (`tsc`, eslint pe fișierele proprii, testele proprii).
3. Lead: revizuire, integrare, `npm run check`, `next build`, integrarea de clasificare pe Haiku, commit per WP.
4. Utilizator: migrările 016 + 017 în SQL Editor, apoi e2e.
