# implicarecivica.ro

Platformă civică pentru cereri de informații publice conform Legii 544/2001 (Next.js 15, Supabase, Vercel). Două module:

- **Manager 544** (`src/manager-544/`): chat asistat pentru formularea cererii, trimiterea cererilor prin email, primirea și clasificarea automată a răspunsurilor, urmărirea termenelor legale, dashboard, administrare conturi. Documentat aici.
- **Campanii** (`app/campanii`, `lib/campanii`, `components/campanii`): campanii de email civic. Ascuns în producție (middleware), în afara refactorului din 2026-09.

## Arhitectura managerului 544

```
src/manager-544/
  shared/     env (fail-fast), http (json/erori/zod), auth (requireUser/Admin/CronSecret/WebhookSecret,
              middleware pur, callback), db (clienți Supabase, repository-uri tipate), rate-limit, types, utils
  pipeline/   email primit → OCR (Mistral) → analiză/clasificare (Claude Haiku) → potrivire cu cererea → status
              → învață adresa verificată a instituției (institutii_locale)
  inbound/    webhook Cloudflare Email Worker (R2 → MIME → atașamente → DB), reconciliere R2 (cron), adaptor campanii,
              webhook Resend (livrare)
  requests/   sesiuni + cereri, limita zilnică, șablon email, utilitare (extragere întrebare, termene, CSV)
  emails/     trimitere (Resend), URL semnat atașamente, revizuire manuală + feedback pe clasificare, interogări client
  notifications/ digest zilnic de termene (cron + Resend)
  public-stats/  date deschise pe instituție (agregate anonimizate)
  questions/  generarea celor 5×10 întrebări strategice (Claude Haiku)
  chat/       asistent 544: guardrails pe pași, prompt, tool-uri (rag_search local + adrese verificate + web_search),
              bucla Anthropic, limită 60 mesaje/zi
  admin/      statistici agregate, aprobare conturi
  feedback/
  ui/         componente și hook-uri React pe funcționalitate (dashboard, emails, requests, chat, settings, admin, auth)
```

Rutele din `app/api/**/route.ts` și paginile din `app/(authenticated)/**` sunt adaptoare subțiri peste aceste module. Regulile de cod (impuse prin ESLint): fișiere sub 200 de linii, fără `any`, `process.env` citit doar prin `shared/env`, dependențele (DB, clienți AI, ceas, fetch) injectate ca parametri cu valori implicite.

Fluxul principal:

1. Utilizatorul descrie problema în chat (STEP_1), Haiku identifică instituția cu `rag_search` (index local peste `data/institutii/*.json`) și găsește emailul oficial cu `web_search` (STEP_2).
2. Wizard-ul generează întrebări strategice (Haiku), utilizatorul le selectează, iar `POST /api/sessions/create` + `POST /api/emails/send` (Resend) trimit câte un email per întrebare, cu limită de 10/zi/instituție.
3. Răspunsurile ajung prin Cloudflare Email Routing → worker → R2 → `POST /api/webhooks/cloudflare-email` → `pipeline/process-email`: OCR pe PDF, clasificare cu Claude Haiku (`inregistrate`, `amanate`, `raspunse`, `intarziate`, `redirectionat`, `irelevant`), potrivire (thread → număr de înregistrare → expeditor), tranziție de status și termene legale în **zile lucrătoare** (10, 30 cu prelungire, 5 pentru refuz; sărbătorile legale românești sunt excluse). Potrivirile incerte primesc `needs_review` și apar în folderul „De revizuit”, unde utilizatorul le asociază manual sau corectează categoria.
4. Cron-urile Vercel: reprocesează emailurile rămase (03:00), marchează cererile depășite ca `delayed` (02:00), trimit digest-ul de termene utilizatorilor cu notificări active (06:00) și reconciliază emailurile rămase în R2 după un webhook eșuat (la 6 ore).

## Furnizori și variabile de mediu

| Furnizor | Rol | Variabile |
|---|---|---|
| Supabase | DB, auth, storage, realtime | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Anthropic | chat + întrebări + clasificare emailuri (Claude Haiku 4.5, web search nativ) | `ANTHROPIC_API_KEY`, opțional `ANALYSIS_PROVIDER` (implicit `anthropic`), `ANALYSIS_MODEL` |
| Mistral | OCR (și clasificare dacă `ANALYSIS_PROVIDER=mistral`) | `MISTRAL_API_KEY`, opțional `ANALYSIS_MODEL` / `MISTRAL_ANALYSIS_MODEL` |
| Resend | trimitere emailuri, digest de termene (`notificari@<domeniu>`) + webhook livrare | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NEXT_PUBLIC_EMAIL_DOMAIN` |
| Cloudflare | primire emailuri (worker + R2) | `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` |
| Vercel | cron | `CRON_SECRET` |
| Admin | dashboard admin | `ADMIN_EMAILS` (obligatoriu în producție) |

Vezi `.env.example`. Secretele lipsă sau cu valoare „placeholder" produc 500 „misconfigured", niciodată acces liber.

## Dezvoltare

```bash
npm install
cp .env.example .env.local   # completează cheile
npm run dev
npm run check                # tsc + eslint + teste unitare (~1 min)
```

Testare: vezi `docs/testing.md`. Migrări DB: `supabase/migrations/README.md`.

## Checklist de deploy

1. Rulează migrările `016_refactor_hardening.sql` și `017_improvements.sql` în Supabase (o singură dată, idempotente).
2. În Vercel setează toate variabilele din tabel, inclusiv `CRON_SECRET` și `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` (același secret ca în worker-ul Cloudflare: `WEBHOOK_SECRET`).
3. `NEXT_PUBLIC_VERCEL_ENV=production` (Vercel o expune automat dacă „System Environment Variables" e activat).
4. Redeploy worker-ul Cloudflare (`cd cloudflare-email-worker && npx wrangler deploy`); token-ul R2 folosit de Vercel trebuie să permită listarea bucket-ului `email-staging`.
5. Deploy; verifică `GET /api/chat-haiku` (health) și că `POST /api/emails/process` fără header răspunde 401.
