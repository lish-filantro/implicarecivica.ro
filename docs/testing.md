# Testare

Trei straturi, de la ieftin la scump. Toate folosesc Vitest.

| Comandă | Ce rulează | Servicii externe | Durată |
|---|---|---|---|
| `npm run test:unit` | `tests/unit/**` — fiecare funcție din `src/manager-544`, cu repository-uri false în memorie și clienți AI injectați; contract tests pentru toate rutele; hook-uri și componente React (jsdom) | niciunul | ~1 min |
| `RUN_DB_TESTS=1 npx vitest run tests/unit/m544/shared/repos.test.ts` | contractul repository-urilor și pe Supabase real (utilizatorul de test) | Supabase | ~30 s |
| `npm run test:integration` | OCR pe cele 37 PDF-uri (cache în `tests/snapshots/ocr-cache.json`; `FRESH_OCR=1` forțează), clasificarea pe fiecare PDF cu furnizorul din `ANALYSIS_PROVIDER` (snapshot `classification-golden.<provider>.json`; `UPDATE_GOLDEN=1` îl rescrie), potrivirea pe DB | Anthropic (sau Mistral), Supabase | 3–5 min |
| `npm run test:e2e` | 7 scenarii complete (fericit, prelungire, refuz, redirecționare, clarificări, sesiune cu 3 cereri, cazuri limită): inserție email + PDF în Supabase, pipeline real, verificare status/termene/sesiune | Anthropic, Mistral (OCR), Supabase | ~3 min |
| `npm run test:smoke` | chatul prin handler cu Anthropic real (STEP_1, STEP_2 cu `rag_search` + `web_search`) | Anthropic | ~15 s |
| `npm run test:browser` (`:prod`) | Playwright în Chromium pe aplicația reală: login, chat → card instituție → wizard precompletat, wizard → email real → instituția (cont de platformă) răspunde prin Resend → revizuire manuală → răspuns final → corectare clasificare; vezi `tests/browser/README.md` | Supabase, Resend, Anthropic, Cloudflare | ~10 min |
| `npm run check` | tsc + eslint + unit — poarta minimă înainte de commit | niciunul | ~1 min |

## Date necesare

- PDF-urile de test sunt în afara repo-ului: `D:/implicare civica/544-FULL-APP/django-544-backend/test_data_pdfs` (cale în `tests/helpers/pdf-loader.ts`).
- Testele de integrare și e2e scriu în proiectul Supabase din `.env.local` doar pentru utilizatorul de test `a0000000-e2e0-4000-a000-000000000001` (`test-cetatean@implicarecivica.ro`) și șterg datele la final.
- Migrările `016` și `017` trebuie aplicate; altfel categoriile `irelevant`/`redirectionat` încalcă constrângerea veche, iar `institutii_locale`/`classification_feedback` lipsesc.
- Clasificarea pe Haiku: 60/60 verificări pe cele 37 PDF-uri (2026-09-08); ministral-14b: 56/58.
- Cheia Mistral gratuită permite doar `ministral-*` pentru text; e relevant doar cu `ANALYSIS_PROVIDER=mistral`.

## Convenții

- Un test per fișier sursă, în oglindă: `src/manager-544/x/y.ts` → `tests/unit/m544/x/y.test.ts`.
- Fake-urile comune sunt în `tests/unit/m544/_fakes/`; cele specifice unui modul stau lângă testele lui (`_fakes.ts`).
- Testele care randează pun `// @vitest-environment jsdom` pe prima linie și mock-uiesc `next/navigation`.
- Nu se mock-uiesc modulele cu `vi.mock` decât pentru `next/navigation`: dependențele se injectează.
