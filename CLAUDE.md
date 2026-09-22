# CLAUDE.md

Instrucțiuni pentru agenții care lucrează în acest repo. Citește-le înainte de prima modificare.

## Ce e aplicația

Platformă civică (Next.js App Router + Supabase) cu două module:

- **`src/manager-544/`** — managerul cererilor de informații publice (Legea 544/2001): wizard de
  trimitere, pipeline de procesare a răspunsurilor primite pe email, termene legale, notificări.
  **Aici e grosul muncii.** Alias: `@m544/*` → `src/manager-544/*`.
- **`app/campanii/`, `lib/campanii/`** — modulul de campanii de emailuri. Separat; nu-l atinge
  decât dacă ți se cere explicit.

Restul: `app/` (rute), `components/` (UI public), `lib/` (utilitare partajate), `data/institutii/`
(86 fișiere JSON curate, sursa pentru căutarea de instituții), `supabase/migrations/`,
`cloudflare-email-worker/` (worker separat, se deployează cu `npx wrangler deploy` din folderul lui).

Aliasuri: `@/*` → rădăcina repo-ului, `@m544/*` → `src/manager-544/*`. Sunt definite în
`tsconfig.json` **și** în `vitest.config.ts` — dacă adaugi unul, adaugă-l în ambele.

## Poarta minimă înainte de orice commit

```bash
npm run check   # tsc --noEmit + eslint + vitest run tests/unit  (~1 min)
```

Nu raporta „gata" / „merge" / „rezolvat" fără să fi rulat comanda și să fi citit output-ul.
Lipește output-ul real în raport. Dacă testele pică, spune că pică — nu rotunji.

Restul straturilor de testare (integration, e2e, smoke, browser) și ce servicii externe cer
sunt în **[docs/testing.md](docs/testing.md)**. Citește-l înainte să scrii teste; are convențiile
de nume, de fake-uri și regula „nu se mock-uiește cu `vi.mock`, se injectează dependențele".

**`@testing-library/jest-dom` NU este instalat** și `tests/setup/test-env.ts` nu îl încarcă. Deci
`toBeInTheDocument`, `toHaveAttribute` și `toHaveTextContent` nu există — dau `TypeError`. Nu
instala pachetul ca să le folosești; scrie aserțiunile pe DOM direct, ca în testele existente
(`tests/unit/public/components/home/*.test.tsx`):

```ts
expect(link.getAttribute('href')).toBe('/emails');
expect(el.textContent).toContain('Bun venit');
expect(screen.queryByRole('link', { name: /notificări/i })).toBeNull();
```

`next/link` se randează fără probleme în jsdom; nu are nevoie de mock.

## Git

- **Niciodată `git add -A` / `git add .`** — adaugă explicit fișierele pe care le-ai modificat.
  Repo-ul are constant fișiere de lucru netrackuite care nu trebuie comise.
- Nu comite pe `main` direct și nu face push decât dacă ți se cere.
- `.worktrees/` conține worktree-uri de lucru; nu le comite și nu edita în ele din greșeală
  (există copii identice ale fișierelor din `src/` acolo — verifică de două ori calea).

## Migrări Supabase

- Numerotare strict incrementală: `supabase/migrations/NNN_nume.sql`.
- **Numărul migrării se alocă în planul de lucru, nu de către tine.** Dacă ai nevoie de o migrare
  și planul nu ți-a dat un număr, oprește-te și cere-l — doi agenți care aleg „următorul liber"
  produc două fișiere `019_`.
- Migrările se aplică manual de către owner. Ultima din repo, `018_conversation_handoff.sql`,
  **este aplicată** (verificat pe 2026-09-22: coloana `conversations.handoff` există). Nu
  presupune nimic despre o migrare nouă până nu o verifici — interoghează coloana.

## Termenele Legii 544/2001

Sunt **zile calendaristice** calculate „pe zile libere", **nu zile lucrătoare** (Norme metodologice
HG 123/2002 art. 16, în forma dată de HG 478/2016 pct. 11). Nu intră în calcul nici ziua de start,
nici ziua împlinirii; dacă ultima zi e nelucrătoare, termenul se rostogolește în prima zi lucrătoare.

Aritmetica e în [`src/manager-544/shared/utils/legal-days.ts`](src/manager-544/shared/utils/legal-days.ts).
Oracolul cu cazurile de referință e în [`tests/fixtures/legal-deadline-oracle.ts`](tests/fixtures/legal-deadline-oracle.ts).
Dacă schimbi ceva la termene, treci prin oracol, nu prin exemple inventate.

Randările HTML de pe site-urile de legislație care spun „10 zile lucrătoare" contrazic textul
actului modificator și nu sunt o sursă.

## Furnizori AI

- **Chat: Sonnet 5** (`CHAT_MODEL`), cu `web_search` + `web_fetch`. Sonnet 5 **nu acceptă
  `temperature`** — răspunde 400 „temperature is deprecated for this model". Nu-l adăuga.
- **Clasificare + generare de întrebări: Haiku.**
- **Mistral: doar OCR.** Cheia gratuită permite doar modelele `ministral-*` pentru text.
- OpenAI a fost scos complet din proiect. Nu-l reintroduce.
- Adresa de email a unei instituții se **verifică online** înainte de trimitere; adresa din DB e
  doar un indiciu, nu o sursă de adevăr.

## Scrierea codului

- Comentariile explică **de ce**, nu **ce**. Multe fișiere au un bloc de antet care documentează
  regula de business sau decizia de design — păstrează-l și actualizează-l dacă schimbi regula.
- Româna cu diacritice în textele de interfață și în comentariile de domeniu; engleza e ok în
  comentariile tehnice. Urmează stilul fișierului pe care îl editezi, nu impune altul.
- Fișiere mici, cu o singură responsabilitate; testele oglindesc calea sursei.

## Dark mode

Class-based, tokeni prin variabile CSS + script de temă inline. Orice UI nou trebuie să arate
corect în ambele teme. Verificarea se face cu Playwright (`tests/browser/`), folosind
`tests/browser/.auth/creds.json`.

**Suita browser nu se rulează în paralel** — e un singur cont de test; două sesiuni concurente
se deautentifică reciproc.
