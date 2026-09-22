# Remedierea raportului de testare — plan de implementare

> **Pentru agenți:** SUB-SKILL OBLIGATORIU: folosește `superpowers:subagent-driven-development`
> (recomandat) sau `superpowers:executing-plans` ca să execuți planul task cu task. Pașii folosesc
> sintaxa checkbox (`- [ ]`) pentru urmărire.

**Scop:** remedierea celor 11 observații din raportul de testare din 2026-09-22, plus câmpul de gen
și rescrierea textului cererii.

**Arhitectură:** cinci loturi grupate **pe metodă de verificare**, nu pe zonă funcțională, ca fiecare
lot să poată fi acceptat sau respins singur. L1 e format din funcții pure verificabile fără DB și fără
browser; L2 e un script one-shot deja scris; L3 atinge pipeline-ul de procesare; L4 e UI; L5 cuplează
o migrare cu textul cererii.

**Tech stack:** Next.js App Router (React 19), TypeScript, Supabase, Vitest (+ jsdom), Playwright,
Resend, Tailwind.

**Spec:** [2026-09-22-feedback-testare-design.md](2026-09-22-feedback-testare-design.md) — planul
argumentează din ea; se citesc împreună.

## Constrângeri globale

Se aplică implicit la **fiecare** task de mai jos.

- **Poarta minimă:** `npm run check` (tsc + eslint + unit, ~1 min) trebuie să treacă înainte de orice
  commit. Lipește output-ul real în raport; nu raporta „merge" fără să-l fi citit.
- **Niciodată `git add -A` / `git add .`** — adaugă explicit fișierele listate în task.
- **Un singur număr de migrare alocat în tot valul: `019`**, în Task 10. Niciun alt task nu creează
  migrări. `018_conversation_handoff.sql` **este aplicată** (verificat în DB pe 2026-09-22).
- **Convenții de testare:** un test per fișier sursă, în oglindă (`src/manager-544/x/y.ts` →
  `tests/unit/m544/x/y.test.ts`). Dependențele se **injectează**, nu se mock-uiesc cu `vi.mock`
  (singura excepție: `next/navigation`). Testele care randează pun `// @vitest-environment jsdom` pe
  prima linie. Detalii în [docs/testing.md](../testing.md).
- **Termenele Legii 544/2001 sunt zile calendaristice „pe zile libere"**, nu zile lucrătoare. Nu
  reintroduce `addBusinessDays` nicăieri.
- **Româna cu diacritice** în textele de interfață. Urmează stilul fișierului pe care îl editezi.
- **Suita Playwright nu se rulează în paralel** și nu se rulează per task — o singură dată, la final.

### Corecții învățate în L1 și L4 (2026-09-22) — citește-le înainte de orice test nou

Snippetele de test din task-urile de mai jos au fost scrise fără a fi rulate. Cinci lucruri au
ieșit la iveală; nu le repeta:

1. **`@testing-library/jest-dom` NU e instalat.** `toBeInTheDocument`, `toHaveAttribute`,
   `toHaveTextContent` dau `TypeError`. Scrie `el.getAttribute(...)`, `el.textContent`,
   `expect(x).toBeNull()`. **Nu instala pachetul.**
2. **`@testing-library/user-event` NU e instalat.** Folosește `fireEvent` din
   `@testing-library/react`.
3. **jsdom nu implementează `window.matchMedia`.** Orice componentă care randează
   `DarkModeToggle` are nevoie de un stub în `beforeAll`, altfel testul pică din alt motiv decât
   cel testat — un roșu fals-pozitiv. Model în `tests/unit/public/components/PublicNavbar.test.tsx`.
4. **Verifică dacă testul există deja înainte să-l „creezi".** La Task 8, fișierul exista și
   afirma explicit comportamentul vechi; un al doilea fișier ar fi lăsat suita roșie. La fel,
   caută testele existente care afirmă comportamentul pe care îl schimbi — Task 5 a spart unul.
5. **Deschide componenta înainte să scrii props în test.** Snippetul pentru `PreviewModal` folosea
   `selectedQuestions`, dar componenta primește `wizard`. Folosește fixturile din fișierul vecin,
   nu obiecte fabricate cu `as unknown as`.

## Structura fișierelor

**Create:**

| Fișier | Responsabilitate |
|---|---|
| `src/manager-544/inbound/webhook/mime-words.ts` | Decodare RFC 2047 („encoded-words") — funcție pură, fără dependențe |
| `tests/unit/m544/inbound/mime-words.test.ts` | Testul ei |
| `tests/unit/institutii-load.test.ts` | Aserțiune peste toate cele 86 de fișiere din `data/institutii/` |
| `supabase/migrations/019_profile_gender.sql` | Coloana `gender` pe `profiles` + propagarea din metadatele de înregistrare |
| `src/manager-544/admin/approval-email.ts` | Conținutul emailului de confirmare a contului |
| `tests/unit/m544/admin/approval-email.test.ts` | Testul lui |

**Modificate:** `lib/institutii/load.ts`, `src/manager-544/inbound/webhook/payload.ts`,
`src/manager-544/pipeline/process-email.ts`,
`src/manager-544/ui/dashboard/DashboardHeader.tsx`, `src/manager-544/ui/dashboard/useDashboardData.ts`,
`components/shared/PublicNavbar.tsx`, `components/public/institutie/Procedura544.tsx`,
`src/manager-544/ui/requests/preview/PreviewModal.tsx`, `app/(auth)/register/page.tsx`,
`src/manager-544/requests/email-template.ts`, `src/manager-544/requests/utils/question-extraction.ts`,
`src/manager-544/admin/users.ts`.

---

# LOT 1 — funcții pure și date

Cele două task-uri ating fișiere disjuncte și pot rula **în paralel**, în worktree-uri separate.

---

### Task 1: Decodarea subiectului emailurilor primite (RFC 2047)

**Findings:** F2.

**Files:**
- Create: `src/manager-544/inbound/webhook/mime-words.ts`
- Create: `tests/unit/m544/inbound/mime-words.test.ts`
- Modify: `src/manager-544/inbound/webhook/payload.ts`

- Modify: `tests/unit/m544/inbound/payload.test.ts`

**Interfaces:**
- Consumes: nimic din alte task-uri.
- Produces: `decodeEncodedWords(value: string): string` din `@m544/inbound/webhook/mime-words`.
  Idempotentă: un text fără encoded-words se întoarce neschimbat.

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/m544/inbound/mime-words.test.ts`:

```ts
/**
 * Decodarea „encoded-words" din headere (RFC 2047). Cazul din raportul de testare este
 * primul: subiectul sosea afişat ca `=?UTF-8?Q?Re:_Cerere_informa=C8=9Bii...?=`.
 */
import { describe, it, expect } from 'vitest';
import { decodeEncodedWords } from '@m544/inbound/webhook/mime-words';

describe('decodeEncodedWords', () => {
  it('decodează cazul exact din raportul de testare', () => {
    expect(
      decodeEncodedWords('=?UTF-8?Q?Re:_Cerere_informa=C8=9Bii_publice_-_Legea_544/2001?='),
    ).toBe('Re: Cerere informații publice - Legea 544/2001');
  });

  it('decodează base64 (encoding B)', () => {
    expect(decodeEncodedWords('=?UTF-8?B?UsSDc3B1bnMgbGEgY2VyZXJl?=')).toBe('Răspuns la cerere');
  });

  it('acceptă indicativul de encoding cu literă mică', () => {
    expect(decodeEncodedWords('=?utf-8?q?test_=C8=99i_diacritice?=')).toBe('test și diacritice');
  });

  it('uneşte encoded-words adiacente fără spaţiul dintre ele', () => {
    expect(decodeEncodedWords('=?UTF-8?Q?Cerere_?= =?UTF-8?Q?informa=C8=9Bii?=')).toBe(
      'Cerere informații',
    );
  });

  it('păstrează spaţiul dintre un encoded-word şi text obişnuit', () => {
    expect(decodeEncodedWords('=?UTF-8?Q?R=C4=83spuns?= la cererea dvs.')).toBe(
      'Răspuns la cererea dvs.',
    );
  });

  it('decodează ISO-8859-2 (instituţii cu servere vechi)', () => {
    // 0xE3 este „ă" (U+0103) în ISO-8859-2; în ISO-8859-1 acelaşi octet e „ã". Charsetul
    // declarat decide — exact motivul pentru care nu presupunem UTF-8.
    expect(decodeEncodedWords('=?iso-8859-2?Q?R=E3spuns?=')).toBe('Răspuns');
  });

  it('lasă textul simplu neschimbat', () => {
    expect(decodeEncodedWords('Cerere informații publice - Legea 544/2001')).toBe(
      'Cerere informații publice - Legea 544/2001',
    );
  });

  it('este idempotentă', () => {
    const once = decodeEncodedWords('=?UTF-8?Q?R=C4=83spuns?=');
    expect(decodeEncodedWords(once)).toBe(once);
  });

  it('lasă neatins un encoded-word cu charset necunoscut, în loc să arunce', () => {
    const input = '=?x-inventat?Q?ceva?=';
    expect(decodeEncodedWords(input)).toBe(input);
  });

  it('lasă neatins un encoded-word trunchiat', () => {
    expect(decodeEncodedWords('=?UTF-8?Q?fara_terminator')).toBe('=?UTF-8?Q?fara_terminator');
  });

  it('tratează şirul gol', () => {
    expect(decodeEncodedWords('')).toBe('');
  });
});
```

- [ ] **Pasul 2: Rulează testul ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/inbound/mime-words.test.ts
```

Așteptat: FAIL — `Failed to resolve import "@m544/inbound/webhook/mime-words"`.

- [ ] **Pasul 3: Scrie implementarea**

`src/manager-544/inbound/webhook/mime-words.ts`:

```ts
/**
 * Decodarea „encoded-words" din headerele de email (RFC 2047): `=?charset?encoding?text?=`.
 *
 * De ce aici şi nu din `postal-mime`. Parserul MIME expune un subiect deja decodat, dar el
 * rulează abia după ce subiectul a fost folosit pentru detectarea campaniilor (`ingest.ts`) şi
 * nu rulează deloc pe calea de reconciliere din R2, care reconstruieşte plicul din
 * customMetadata. Decodarea în plic acoperă uniform toate căile cu o singură funcţie pură.
 *
 * Reguli implementate:
 *  - encoding `Q` (quoted-printable adaptat): `_` înseamnă spaţiu, `=XX` un octet hexazecimal;
 *  - encoding `B`: base64;
 *  - spaţiul alb dintre două encoded-words adiacente se elimină (RFC 2047 §6.2), dar spaţiul
 *    dintre un encoded-word şi text obişnuit se păstrează;
 *  - orice lucru pe care nu îl putem decoda în siguranţă (charset necunoscut, base64 invalid,
 *    terminator lipsă) se întoarce neatins: un subiect urât e mai bun decât o excepţie pe calea
 *    de ingestie, care ar bloca primirea emailului.
 */

/** `=?charset?encoding?text?=` — textul nu poate conţine spaţii sau `?`. */
const ENCODED_WORD = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

/** Charseturi pe care le ştim mapa la un TextDecoder; altfel lăsăm textul neatins. */
function decodeBytes(bytes: Uint8Array, charset: string): string | null {
  const label = charset.toLowerCase().split('*')[0]; // RFC 2231 poate adăuga `*limbă`
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function decodeQ(text: string): Uint8Array {
  const withSpaces = text.replace(/_/g, ' ');
  const bytes: number[] = [];
  for (let i = 0; i < withSpaces.length; i += 1) {
    const ch = withSpaces[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(withSpaces.slice(i + 1, i + 3))) {
      bytes.push(parseInt(withSpaces.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function decodeB(text: string): Uint8Array | null {
  try {
    return Uint8Array.from(Buffer.from(text, 'base64'));
  } catch {
    return null;
  }
}

/**
 * Întoarce `value` cu fiecare encoded-word decodat. Textul fără encoded-words trece neschimbat,
 * deci funcţia e idempotentă şi poate fi aplicată defensiv oriunde.
 */
export function decodeEncodedWords(value: string): string {
  if (!value.includes('=?')) return value;

  // Marcăm spaţiul alb dintre două encoded-words adiacente ca să îl putem elimina după decodare.
  const joined = value.replace(/(\?=)\s+(=\?)/g, '$1\u0000$2');

  const decoded = joined.replace(ENCODED_WORD, (whole, charset: string, encoding: string, text: string) => {
    const bytes = encoding.toUpperCase() === 'B' ? decodeB(text) : decodeQ(text);
    if (!bytes) return whole;
    return decodeBytes(bytes, charset) ?? whole;
  });

  // Separatorul rămâne doar dacă unul dintre vecini nu a putut fi decodat; atunci era spaţiu real.
  return decoded.replace(/\u0000/g, (_m, offset: number, s: string) =>
    s.slice(0, offset).endsWith('?=') ? ' ' : '',
  );
}
```

- [ ] **Pasul 4: Rulează testul ca să verifici că trece**

```bash
npx vitest run tests/unit/m544/inbound/mime-words.test.ts
```

Așteptat: PASS, 11 teste.

- [ ] **Pasul 5: Aplică decodarea în plic**

În `src/manager-544/inbound/webhook/payload.ts`, adaugă importul și decodează subiectul:

```ts
import { decodeEncodedWords } from './mime-words';
```

și înlocuiește linia din `parseWorkerPayload`:

```ts
      subject: p.subject?.trim() || DEFAULT_SUBJECT,
```

cu:

```ts
      // Headerul ajunge aici exact cum l-a trimis instituţia, inclusiv `=?UTF-8?Q?...?=`.
      subject: decodeEncodedWords(p.subject?.trim() ?? '') || DEFAULT_SUBJECT,
```

**`reconcile.ts` NU se modifică.** `envelopeFromMetadata()` (reconcile.ts:53-66) apelează chiar
`parseWorkerPayload`, deci calea de reconciliere din R2 primeşte subiectul decodat gratis. O
decodare suplimentară acolo ar fi inofensivă (funcţia e idempotentă), dar ar sugera un flux care nu
există. Verificat pe 2026-09-22.

- [ ] **Pasul 6: Adaugă testul de integrare în plic**

În `tests/unit/m544/inbound/payload.test.ts`, adaugă în interiorul blocului `describe` existent:

```ts
  it('decodează subiectul encodat RFC 2047 (cazul din raportul de testare)', () => {
    const result = parseWorkerPayload({
      from: 'inarion-all@yahoo.com',
      to: 'irina.bogdan@implicarecivica.ro',
      subject: '=?UTF-8?Q?Re:_Cerere_informa=C8=9Bii_publice_-_Legea_544/2001?=',
      r2_key: 'inbound/2026-09-17-test.eml',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.subject).toBe('Re: Cerere informații publice - Legea 544/2001');
    }
  });
```

- [ ] **Pasul 7: Rulează toate testele de inbound**

```bash
npx vitest run tests/unit/m544/inbound
```

Așteptat: PASS, inclusiv testele existente (`payload`, `ingest`, `reconcile`) neschimbate.

- [ ] **Pasul 8: Poarta minimă**

```bash
npm run check
```

- [ ] **Pasul 9: Commit**

```bash
git add src/manager-544/inbound/webhook/mime-words.ts \
        tests/unit/m544/inbound/mime-words.test.ts \
        src/manager-544/inbound/webhook/payload.ts \
        tests/unit/m544/inbound/payload.test.ts
git commit -m "Inbound: decodează subiectele RFC 2047 în plic, nu doar la parsarea MIME"
```

---

### Task 2: Denumirile instituțiilor cu placeholder

**Findings:** F1.

**Files:**
- Modify: `lib/institutii/load.ts:30-46`
- Create: `tests/unit/institutii-load.test.ts`

**Interfaces:**
- Consumes: nimic.
- Produces: garanția că `getAllInstitutii()` întoarce `nume_oficial` și `nume_scurt` nevide, fără
  spații duble și fără cuvinte lipite, pentru toate intrările.

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/institutii-load.test.ts`:

```ts
/**
 * Randarea denumirilor de instituţii. Template-urile poartă placeholdere (`{JUDET}`,
 * `{LOCALITATE}`) care se scot la afişarea în lista generică; scoaterea lor nu are voie să
 * lipească cuvintele vecine şi nici să lase o intrare fără nume.
 *
 * Aserţiunile rulează peste TOT datasetul, nu peste exemple alese de mână: bugul raportat
 * („Comisariatul Judeţuluial Gărzii Naţionale de Mediu") a scăpat fiindcă exemplele testate
 * aveau placeholderul la final, unde defectul nu se vede.
 */
import { describe, it, expect } from 'vitest';
import { getAllInstitutii } from '@/lib/institutii/load';

const institutii = getAllInstitutii();

describe('getAllInstitutii — denumiri', () => {
  it('încarcă tot datasetul', () => {
    expect(institutii.length).toBeGreaterThan(80);
  });

  it('nu lasă niciun nume gol', () => {
    const goale = institutii.filter((i) => !i.nume_oficial.trim() || !i.nume_scurt.trim());
    expect(goale.map((i) => i.id)).toEqual([]);
  });

  it('nu lasă urme de placeholder', () => {
    const cuAcolade = institutii.filter(
      (i) => /[{}]/.test(i.nume_oficial) || /[{}]/.test(i.nume_scurt),
    );
    expect(cuAcolade.map((i) => i.id)).toEqual([]);
  });

  it('nu lasă spaţii duble sau spaţii la capete', () => {
    const rele = institutii.filter(
      (i) =>
        /\s{2}/.test(i.nume_oficial) ||
        i.nume_oficial !== i.nume_oficial.trim() ||
        /\s{2}/.test(i.nume_scurt) ||
        i.nume_scurt !== i.nume_scurt.trim(),
    );
    expect(rele.map((i) => i.id)).toEqual([]);
  });

  // Cuvintele lipite nu se pot detecta cu un tipar („Județului" + „al" = „Județuluial" e literă
  // mică lângă literă mică). Le fixăm ca valori exacte, calculate din sursă pe 2026-09-22.
  it.each([
    ['COMISARIAT_GARDA_MEDIU_TEMPLATE', 'Comisariatul Județului al Gărzii Naționale de Mediu'],
    ['CENTRU_JUDETEAN_APIA_TEMPLATE', 'Centrul Județean al APIA'],
    [
      'DJFP_TEMPLATE',
      'Direcția Generală Regională a Finanțelor Publice - Administrația Județeană a Finanțelor Publice',
    ],
  ])('randează %s fără cuvinte lipite', (id, asteptat) => {
    expect(institutii.find((i) => i.id === id)?.nume_oficial).toBe(asteptat);
  });

  it('nu lipeşte cuvintele nici în numele scurt', () => {
    expect(institutii.find((i) => i.id === 'DGITL_TEMPLATE')?.nume_scurt).toBe(
      'DGITL sau Serviciul Fiscal Local',
    );
  });

  it('dă un nume şi intrării al cărei nume era numai placeholdere', () => {
    // `{TIP_SCOALA} {NUME_SCOALA}` — rândul gol din raportul de testare. Cade pe tip_institutie.
    const scoala = institutii.find((i) => i.id === 'SCOALA_PUBLICA_TEMPLATE');
    expect(scoala?.nume_oficial).toBe('Școală Publică / Liceu Public');
    expect(scoala?.nume_scurt).toBe('Școală Publică / Liceu Public');
  });
});
```

- [ ] **Pasul 2: Rulează testul ca să verifici că pică**

```bash
npx vitest run tests/unit/institutii-load.test.ts
```

Așteptat: FAIL pe „nu lasă niciun nume gol" (`SCOALA_PUBLICA_TEMPLATE`), pe cele trei cazuri din
`it.each` (`Comisariatul Județuluial…`, `Centrul Județeanal APIA`, `…Publice- Administrația…`), pe
numele scurt `DGITLsau Serviciul Fiscal Local` și pe testul şcolii.

- [ ] **Pasul 3: Scrie implementarea**

În `lib/institutii/load.ts`, adaugă deasupra lui `getAllInstitutii`:

```ts
/**
 * Scoate placeholderele (`{JUDET}`, `{LOCALITATE}`, ...) din numele unui template.
 *
 * Placeholderul se înlocuieşte cu un SPAŢIU, nu cu nimic: varianta veche consuma şi spaţiile
 * vecine, iar „Comisariatul Județului {JUDET} al Gărzii..." devenea „Comisariatul Județuluial
 * Gărzii...". Spaţiile rămase se colapsează la final.
 */
function stripPlaceholders(name: string): string {
  return name.replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim()
}
```

și înlocuiește blocul celor două câmpuri:

```ts
        nume_oficial: isTemplate
          ? (raw.nume_oficial || '').replace(/\s*\{.*?\}\s*/g, '').trim()
          : (raw.nume_oficial || raw.nume_scurt || id),
        nume_scurt: isTemplate
          ? (raw.nume_scurt || raw.nume_oficial || '').replace(/\s*\{.*?\}\s*/g, '').trim()
          : (raw.nume_scurt || raw.nume_oficial || id),
```

cu:

```ts
        // Un template al cărui nume era numai placeholdere (`{TIP_SCOALA} {NUME_SCOALA}`) ar
        // rămâne fără etichetă în lista de căutare; cade pe tipul instituţiei.
        nume_oficial: isTemplate
          ? stripPlaceholders(raw.nume_oficial || '') || raw.tip_institutie || id
          : (raw.nume_oficial || raw.nume_scurt || id),
        nume_scurt: isTemplate
          ? stripPlaceholders(raw.nume_scurt || raw.nume_oficial || '') || raw.tip_institutie || id
          : (raw.nume_scurt || raw.nume_oficial || id),
```

- [ ] **Pasul 4: Rulează testele ca să verifici că trec**

```bash
npx vitest run tests/unit/institutii-load.test.ts tests/unit/institutii-search.test.ts
```

Așteptat: PASS la ambele. Denumirile rămase trunchiate semantic („Consiliul Local al", „Primăria",
„Serviciul de Stare Civilă al") sunt corecte pentru acest task: prepoziţia orfană e o problemă de
conţinut, listată explicit ca fiind în afara planului. Nu adăuga aserţiuni despre ele.

- [ ] **Pasul 5: Poarta minimă**

```bash
npm run check
```

- [ ] **Pasul 6: Commit**

```bash
git add lib/institutii/load.ts tests/unit/institutii-load.test.ts
git commit -m "Instituţii: placeholderul scos din denumiri nu mai lipeşte cuvintele vecine"
```

---

# LOT 2 — termene

---

### Task 3: Backfill-ul termenelor pe datele existente

**Findings:** F3.

**Files:**
- Commit (există, netrackuite): `tools/backfill-legal-deadlines.ts`,
  `tests/unit/tools/backfill-legal-deadlines.test.ts`
- Rulează: scriptul, întâi dry-run

**Interfaces:**
- Consumes: `addLegalDays` din `@m544/shared/utils/legal-days` (deja pe branch).
- Produces: `deadline_date` / `extension_date` corecte în DB.

**Atenție:** singurul task din val care **scrie în baza de date de producție**. Nu-l rula în paralel
cu altceva. Pasul de `--apply` se execută numai după ce owner-ul a citit planul din dry-run.

- [ ] **Pasul 1: Verifică testul planificatorului**

```bash
npx vitest run tests/unit/tools/backfill-legal-deadlines.test.ts
```

Așteptat: PASS, 8 teste. (Verificat pe 2026-09-22 — trece.)

- [ ] **Pasul 2: Poarta minimă**

```bash
npm run check
```

- [ ] **Pasul 3: Commit-ul uneltei, înainte de a o rula**

```bash
git add tools/backfill-legal-deadlines.ts tests/unit/tools/backfill-legal-deadlines.test.ts
git commit -m "Unealtă: backfill pentru termenele calculate cu aritmetica veche"
```

- [ ] **Pasul 4: Dry-run**

```bash
npx tsx tools/backfill-legal-deadlines.ts
```

Așteptat: planul tipărit, „DRY RUN — nu s-a scris nimic". Citește câte rânduri se schimbă și verifică
manual două-trei: termenul nou trebuie să fie `data_înregistrării + 10 + 1`, rostogolit în prima zi
lucrătoare.

- [ ] **Pasul 5: OPRIRE — confirmarea owner-ului**

Arată planul owner-ului. Nu trece mai departe fără un „da" explicit. Scriptul nu schimbă `status`:
o cerere marcată `delayed` prea devreme de aritmetica veche rămâne așa.

- [ ] **Pasul 6: Aplică**

```bash
npx tsx tools/backfill-legal-deadlines.ts --apply
```

Așteptat: „Aplicat: N rânduri actualizate.", fără scrieri eșuate.

- [ ] **Pasul 7: Verifică pe cererea din raport**

Deschide dashboardul și confirmă că sesiunea „APM — Solicitare avize mediu..." afișează termenul
recalculat, nu `14z`.

---

# LOT 3 — pipeline

---

### Task 4: Răspunsurile necorelate ajung la revizuire manuală

> **⛔ NU EXECUTA ACEST TASK — e deja rezolvat, altfel decât mai jos.** Owner-ul l-a implementat
> el, în paralel, pe 2026-09-22. Paşii rămân scrişi doar ca istoric al analizei cauzei.
>
> **Ce s-a construit efectiv, şi de ce e mai bun decât ce propuneam aici:** garda stă la locul
> apelului — [`process-email.ts:168`](../../src/manager-544/pipeline/process-email.ts) sare peste
> potrivire pentru `irelevant`, deci orice email care ajunge la `matchAndUpdate` este deja
> corespondenţă relevantă şi se marchează necondiţionat `needs_review` când nu se potriveşte.
> Planul propunea o listă de categorii înăuntrul lui `matchAndUpdate`; varianta owner-ului nu
> duplică cunoaşterea despre categorii în două locuri.
>
> Pe deasupra, atribuirea manuală a fost dusă mai departe decât cerea planul: `ReviewPanel` a
> devenit `AssignPanel`, cu selecţie sesiune → întrebare şi sugestie din adresa expeditorului
> ([`ui/emails/review/assignable.ts`](../../src/manager-544/ui/emails/review/assignable.ts)).

**Findings:** F4.

**Files:**
- Modify: `src/manager-544/pipeline/process-email.ts:104-110`
- Modify: `tests/unit/m544/pipeline/process-email.test.ts`

**Interfaces:**
- Consumes: `MatchOutcome` din `@m544/pipeline/types`, `AnalysisResult.category`.
- Produces: pe `NO_MATCH`, emailul primeşte `needs_review = true` dacă analiza îl clasifică drept
  răspuns la o cerere 544. `ReviewPanel` existent îl preia de acolo; nu se construieşte UI nou.

- [ ] **Pasul 1: Scrie testul care pică**

În `tests/unit/m544/pipeline/process-email.test.ts`, adaugă:

```ts
  it('marchează pentru revizuire un răspuns 544 pe care nu l-a putut asocia niciunei cereri', async () => {
    // Cazul din raportul de testare: instituţia răspunde de pe adresa personală a unui
    // funcţionar şi cu un număr de înregistrare greşit, deci nu există niciun candidat.
    // Fără flag, emailul ajunge în inbox nelegat de nimic şi cererea rămâne „în curs" tăcut.
    const deps = makeDeps({
      analysis: { ...baseAnalysis, category: 'raspunse', registration_number: '999/01.01.2000' },
      openRequests: [],
    });

    const result = await processEmail(receivedEmail, deps);

    expect(result.matchedRequestId).toBeUndefined();
    expect(result.needsReview).toBe(true);
    expect(deps.emails.updates).toContainEqual(
      expect.objectContaining({ id: receivedEmail.id, patch: { needs_review: true } }),
    );
  });

  it('nu marchează pentru revizuire un email care nu are legătură cu o cerere 544', async () => {
    const deps = makeDeps({
      analysis: { ...baseAnalysis, category: 'irelevant', registration_number: null },
      openRequests: [],
    });

    const result = await processEmail(receivedEmail, deps);

    expect(result.needsReview).toBe(false);
    expect(deps.emails.updates).toEqual([]);
  });
```

**Notă pentru implementator:** `makeDeps`, `baseAnalysis` și `receivedEmail` sunt fixturile existente
din fișier. Dacă numele diferă, folosește-le pe cele din fișier — **nu** rescrie fixturile, nu le
duplica și nu introduce `vi.mock`.

- [ ] **Pasul 2: Rulează testul ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/pipeline/process-email.test.ts
```

Așteptat: FAIL — `expected false to be true` pe primul test nou.

- [ ] **Pasul 3: Scrie implementarea**

În `src/manager-544/pipeline/process-email.ts`, deasupra lui `matchAndUpdate`, adaugă:

```ts
/**
 * Categoriile care NU înseamnă „răspuns la o cerere 544". Restul, da.
 *
 * Formulat ca negaţie intenţionat: uniunea `EmailCategory` are şapte valori, dintre care
 * `irelevant` e singura care descrie un email fără legătură cu vreo cerere, iar `trimise` nu
 * apare niciodată pe un email primit. O listă pozitivă ar trebui extinsă la fiecare categorie
 * nouă, şi ar tăcea exact acolo unde ne doare — un răspuns neclasificat nu ar mai ajunge la
 * revizuire. Aşa, o categorie nouă ajunge implicit la om.
 */
const CATEGORII_FARA_CERERE: ReadonlySet<EmailCategory> = new Set<EmailCategory>(['irelevant', 'trimise']);
```

Importă tipul, dacă nu e deja importat în fişier:

```ts
import type { EmailCategory } from '@m544/shared/types/request';
```

și înlocuiește blocul:

```ts
  if (!outcome.match) {
    if (outcome.needsReview) await deps.emails.update(email.id, { needs_review: true });
    console.log(`[Process] ${email.id}: no match (${outcome.reason})`);
    return { needsReview: outcome.needsReview };
  }
```

cu:

```ts
  if (!outcome.match) {
    // Un răspuns pe care nu l-am putut asocia e o problemă pe care o poate rezolva doar
    // utilizatorul: el ştie de pe ce adresă i-a răspuns instituţia, noi nu. Îl trimitem la
    // revizuire în loc să ghicim — vezi `matching/context.ts` pentru ce înseamnă o ghiceală.
    const needsReview = outcome.needsReview || !CATEGORII_FARA_CERERE.has(analysis.category);
    if (needsReview) await deps.emails.update(email.id, { needs_review: true });
    console.log(`[Process] ${email.id}: no match (${outcome.reason})${needsReview ? ' → revizuire' : ''}`);
    return { needsReview };
  }
```

- [ ] **Pasul 4: Verifică tipul**

```bash
npx tsc --noEmit
```

Așteptat: curat. Uniunea reală e `'trimise' | 'inregistrate' | 'amanate' | 'raspunse' |
'intarziate' | 'irelevant' | 'redirectionat'` (verificată pe 2026-09-22 în
`src/manager-544/shared/types/request.ts:13`); `Set<EmailCategory>` te apără dacă se schimbă.

- [ ] **Pasul 5: Rulează testele**

```bash
npx vitest run tests/unit/m544/pipeline tests/unit/m544/emails
```

Așteptat: PASS peste tot.

- [ ] **Pasul 6: Poarta minimă**

```bash
npm run check
```

- [ ] **Pasul 7: Commit**

```bash
git add src/manager-544/pipeline/process-email.ts tests/unit/m544/pipeline/process-email.test.ts
git commit -m "Pipeline: răspunsul 544 pe care nu îl putem asocia ajunge la revizuire manuală"
```

---

# LOT 4 — interfață

Task-urile 5–9 rulează **serial**, în aceeaşi ramură. Suita Playwright se rulează o singură dată, la
finalul lotului.

---

### Task 5: Titlul dashboardului — prenumele

**Findings:** F10.

**Files:**
- Modify: `src/manager-544/ui/dashboard/useDashboardData.ts:52-56`
- Modify: `src/manager-544/ui/dashboard/DashboardHeader.tsx:16`
- Modify: `tests/unit/m544/ui/dashboard/components.test.tsx`
- Modify: `tests/unit/m544/ui/useDashboardData.test.tsx`

**Interfaces:**
- Produces: `DashboardData.userName` conține doar **prenumele**.

- [ ] **Pasul 1: Scrie testele care pică**

În `tests/unit/m544/ui/useDashboardData.test.tsx`:

```ts
  it('foloseşte prenumele din profil, nu numele complet', async () => {
    const { result } = renderHook(() =>
      useDashboardData({
        loadSessions: async () => [],
        loadProfile: async () => ({ display_name: 'Irina Bogdan', first_name: 'Irina' }),
        loadUnreadCount: async () => 0,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe('Irina');
  });

  it('cade pe primul cuvânt din numele afişat când prenumele lipseşte', async () => {
    const { result } = renderHook(() =>
      useDashboardData({
        loadSessions: async () => [],
        loadProfile: async () => ({ display_name: 'Irina Bogdan', first_name: null }),
        loadUnreadCount: async () => 0,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userName).toBe('Irina');
  });
```

În `tests/unit/m544/ui/dashboard/components.test.tsx`, schimbă aserțiunea existentă pe
`DashboardHeader` din „Bine ai revenit" în:

```ts
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bun venit, Irina!');
```

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/ui/useDashboardData.test.tsx tests/unit/m544/ui/dashboard/components.test.tsx
```

Așteptat: FAIL pe ambele.

- [ ] **Pasul 3: Scrie implementarea**

În `useDashboardData.ts`, înlocuiește:

```ts
        setUserName(
          profile?.display_name
          || profile?.first_name
          || ''
        );
```

cu:

```ts
        // Prenumele, nu numele complet: pe mobil „Bine ai revenit, Irina Bogdan!" se rupea pe
        // două rânduri peste cardurile de sub el.
        setUserName(profile?.first_name?.trim() || profile?.display_name?.trim().split(/\s+/)[0] || '');
```

În `DashboardHeader.tsx`, înlocuiește textul titlului:

```tsx
          Bine ai revenit, {userName}!
```

cu:

```tsx
          Bun venit, {userName}!
```

- [ ] **Pasul 4: Rulează ca să verifici că trec**

```bash
npx vitest run tests/unit/m544/ui
```

Așteptat: PASS.

- [ ] **Pasul 5: Commit**

```bash
git add src/manager-544/ui/dashboard/useDashboardData.ts \
        src/manager-544/ui/dashboard/DashboardHeader.tsx \
        tests/unit/m544/ui/dashboard/components.test.tsx \
        tests/unit/m544/ui/useDashboardData.test.tsx
git commit -m "Dashboard: salut pe prenume, ca titlul să încapă pe un rând"
```

---

### Task 6: Butonul de notificări duce la inbox

**Findings:** F5.

**Files:**
- Modify: `src/manager-544/ui/dashboard/DashboardHeader.tsx:25-47`
- Modify: `tests/unit/m544/ui/dashboard/components.test.tsx`

**Interfaces:**
- Consumes: `unreadNotifications` (numărul de **emailuri necitite**, din `getUnreadCount()`).
- Produces: un link către `/emails`.

- [ ] **Pasul 1: Scrie testul care pică**

```ts
  it('duce la inbox când există emailuri necitite', () => {
    render(<DashboardHeader userName="Irina" unreadNotifications={3} />);
    const link = screen.getByRole('link', { name: /notificări/i });
    expect(link).toHaveAttribute('href', '/emails');
    expect(link).toHaveTextContent('3');
  });

  it('nu afişează nimic când nu există necitite', () => {
    render(<DashboardHeader userName="Irina" unreadNotifications={0} />);
    expect(screen.queryByRole('link', { name: /notificări/i })).toBeNull();
  });
```

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/ui/dashboard/components.test.tsx
```

Așteptat: FAIL — elementul e `button`, nu `link`.

- [ ] **Pasul 3: Scrie implementarea**

În `DashboardHeader.tsx` adaugă importul:

```tsx
import Link from 'next/link';
```

și înlocuiește elementul `<button ...>...</button>` cu:

```tsx
          <Link
            href="/emails"
            className="group relative h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-800
                       border border-gray-200 dark:border-gray-700
                       hover:bg-gray-200 dark:hover:bg-gray-700
                       transition-all duration-300
                       focus:outline-none focus:ring-2 focus:ring-activist-orange-500/50
                       active:scale-95 block"
            aria-label={`Notificări (${unreadNotifications} necitite)`}
          >
            <Bell className="absolute inset-0 m-auto h-4 w-4 text-gray-600 dark:text-gray-400" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center
                             text-[10px] font-bold text-white
                             bg-protest-red-500 rounded-full
                             animate-pulse-activist">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          </Link>
```

**Notă:** contorul numără emailuri necitite, nu notificări de alt fel — `/emails` e destinația
corectă, nu o pagină nouă.

- [ ] **Pasul 4: Rulează ca să verifici că trece**

```bash
npx vitest run tests/unit/m544/ui/dashboard/components.test.tsx
```

- [ ] **Pasul 5: Commit**

```bash
git add src/manager-544/ui/dashboard/DashboardHeader.tsx tests/unit/m544/ui/dashboard/components.test.tsx
git commit -m "Dashboard: clopoţelul de notificări duce la inbox"
```

---

### Task 7: Meniul public pe mobil

**Findings:** F6.

**Files:**
- Modify: `components/shared/PublicNavbar.tsx`
- Create: `tests/unit/public/components/PublicNavbar.test.tsx`

**Interfaces:**
- Produces: sub `md`, linkurile sunt ascunse și există un buton `aria-label="Meniu"` cu
  `aria-expanded`, care deschide un panou ce conține toate linkurile plus CTA.

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/public/components/PublicNavbar.test.tsx`:

```tsx
// @vitest-environment jsdom
/**
 * Meniul public pe ecran mic. Raportul de testare: fără hamburger, cele cinci linkuri plus
 * butonul de login se înghesuiau pe un rând, spre deosebire de zona logată.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicNavbar } from '@/components/shared/PublicNavbar';

describe('PublicNavbar', () => {
  it('are un buton de meniu, închis iniţial', () => {
    render(<PublicNavbar />);
    const buton = screen.getByRole('button', { name: /meniu/i });
    expect(buton).toHaveAttribute('aria-expanded', 'false');
  });

  it('deschide panoul cu toate linkurile şi cu intrarea în cont', async () => {
    const user = userEvent.setup();
    render(<PublicNavbar />);
    await user.click(screen.getByRole('button', { name: /meniu/i }));

    const panou = screen.getByRole('navigation', { name: /meniu mobil/i });
    for (const eticheta of ['Instituții', 'Alegeri 2024', 'Quiz', 'Despre', 'Contact']) {
      expect(screen.getAllByRole('link', { name: eticheta }).length).toBeGreaterThan(0);
    }
    expect(panou).toHaveTextContent('Intră în cont');
  });

  it('închide panoul la a doua apăsare', async () => {
    const user = userEvent.setup();
    render(<PublicNavbar />);
    const buton = screen.getByRole('button', { name: /meniu/i });
    await user.click(buton);
    await user.click(buton);
    expect(buton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: /meniu mobil/i })).toBeNull();
  });
});
```

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/public/components/PublicNavbar.test.tsx
```

Așteptat: FAIL — nu există buton de meniu.

- [ ] **Pasul 3: Scrie implementarea**

Rescrie `components/shared/PublicNavbar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { DarkModeToggle } from '@/components/shared/DarkModeToggle'

const navLinks = [
  { href: '/institutii', label: 'Instituții' },
  { href: '/alegeri-locale-2024', label: 'Alegeri 2024' },
  { href: '/quiz', label: 'Quiz' },
  { href: '/despre', label: 'Despre' },
  { href: '/contact', label: 'Contact' },
]

interface PublicNavbarProps {
  activePage?: string
}

function linkClass(active: boolean): string {
  return active
    ? 'text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400'
    : 'text-sm text-gray-600 dark:text-gray-400 hover:text-civic-blue-600 dark:hover:text-civic-blue-400 transition-colors'
}

const ctaClass =
  'text-sm px-4 py-2 bg-civic-blue-500 text-white rounded-md hover:bg-civic-blue-600 transition-colors'

export function PublicNavbar({ activePage }: PublicNavbarProps) {
  // Sub `md` linkurile nu încap pe un rând; se mută într-un panou, ca în zona logată.
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-50">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" onClick={() => setOpen(false)}>
          <Image
            src="/assets/implicare_civica_logo_navbar.png"
            alt="Implicare Civică"
            width={140}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(activePage === link.href)}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={ctaClass}>
            Intră în cont
          </Link>
          <DarkModeToggle />
        </div>

        <div className="flex md:hidden items-center gap-2">
          <DarkModeToggle />
          <button
            type="button"
            aria-label="Meniu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="p-2 -mr-2 text-gray-700 dark:text-gray-300 rounded-md
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Meniu mobil"
          className="md:hidden border-t border-gray-100 dark:border-gray-800
                     bg-white dark:bg-gray-900 px-6 py-4 flex flex-col gap-4"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={linkClass(activePage === link.href)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className={`${ctaClass} text-center`}>
            Intră în cont
          </Link>
        </nav>
      )}
    </nav>
  )
}
```

- [ ] **Pasul 4: Rulează ca să verifici că trece**

```bash
npx vitest run tests/unit/public
```

Așteptat: PASS, inclusiv testele existente de pagină care randează navbarul.

- [ ] **Pasul 5: Poarta minimă**

```bash
npm run check
```

Dacă eslint se plânge de `'use client'` într-un fișier importat de o pagină server, verifică
paginile care îl folosesc — componenta era până acum server component.

- [ ] **Pasul 6: Commit**

```bash
git add components/shared/PublicNavbar.tsx tests/unit/public/components/PublicNavbar.test.tsx
git commit -m "Navbar public: meniu hamburger sub breakpointul md"
```

---

### Task 8: Cardul instituției — adresa nu mai e `mailto:`, CTA duce în aplicație

**Findings:** F8.

**Files:**
- Modify: `components/public/institutie/Procedura544.tsx:37-50, 85-99`
- Create: `tests/unit/public/components/Procedura544.test.tsx`

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/public/components/Procedura544.test.tsx`:

```tsx
// @vitest-environment jsdom
/**
 * Raportul de testare: apăsarea pe „Trimite o cerere" deschidea clientul de email. Cauza era
 * adresa instituţiei, randată ca `mailto:` imediat deasupra butonului — un click alăturat.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Procedura544 } from '@/components/public/institutie/Procedura544';
import type { Institutie } from '@/lib/institutii/types';

const inst = {
  id: 'APM_TEMPLATE',
  slug: 'apm',
  nume_oficial: 'Agenția pentru Protecția Mediului',
  nume_scurt: 'APM',
  tip_institutie: 'Agenție',
  nivel: 'Județean',
  sediu: { email: 'office@apm.ro', telefon: '021.000.00.00', adresa: 'Str. Test 1' },
  atributii_principale: [],
  cazuri_utilizare_544: [],
  is_template: true,
  nivel_categorie: 'Județean',
} as unknown as Institutie;

describe('Procedura544', () => {
  it('nu randează adresa instituţiei ca link mailto', () => {
    const { container } = render(<Procedura544 inst={inst} />);
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.getByText('office@apm.ro')).toBeInTheDocument();
  });

  it('trimite butonul în aplicaţie, nu către înregistrare', () => {
    render(<Procedura544 inst={inst} />);
    expect(screen.getByRole('link', { name: /trimite o cerere/i })).toHaveAttribute(
      'href',
      '/requests/add',
    );
  });
});
```

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/public/components/Procedura544.test.tsx
```

Așteptat: FAIL pe ambele.

- [ ] **Pasul 3: Scrie implementarea**

În `Procedura544.tsx`, înlocuiește blocul cu `<a href={`mailto:${email}`} ...>` cu un `div` care
păstrează aceeaşi iconiţă și aceleaşi clase, dar nu mai e link:

```tsx
        {email && (
          <div className={`${contactLink} select-all cursor-text`}>
            <svg className={icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {email}
          </div>
        )}
```

și schimbă destinaţia butonului:

```tsx
      <Link
        href="/requests/add"
```

**Notă:** `/requests/add` este ruta protejată; utilizatorul nelogat e redirectat spre login de
middleware, ceea ce e comportamentul dorit — spre deosebire de `/register`, care îl trimitea la
înregistrare chiar dacă avea deja cont.

- [ ] **Pasul 4: Verifică ruta**

```bash
ls "app/(authenticated)/requests"
```

Așteptat: există un segment `add`. Dacă ruta reală diferă, foloseşte-o pe cea reală și
actualizează testul.

- [ ] **Pasul 5: Rulează ca să verifici că trece**

```bash
npx vitest run tests/unit/public
```

- [ ] **Pasul 6: Commit**

```bash
git add components/public/institutie/Procedura544.tsx tests/unit/public/components/Procedura544.test.tsx
git commit -m "Pagina instituţiei: adresa nu mai e mailto, butonul duce în formular"
```

---

### Task 9: Pluralul din previzualizare

**Findings:** F11.

**Files:**
- Modify: `src/manager-544/ui/requests/preview/PreviewModal.tsx:74`
- Modify: `tests/unit/m544/ui/requests/` (testul existent al modalului)

- [ ] **Pasul 1: Scrie testul care pică**

```tsx
  it('foloseşte singularul pentru o singură cerere', () => {
    render(<PreviewModal {...props} selectedQuestions={[props.selectedQuestions[0]]} />);
    expect(screen.getByText(/Se vor trimite/)).toHaveTextContent('1 email separat');
  });

  it('foloseşte pluralul pentru mai multe', () => {
    render(<PreviewModal {...props} />);
    expect(screen.getByText(/Se vor trimite/)).toHaveTextContent('3 emailuri separate');
  });
```

**Notă:** adaptează `props` la fixturile existente din fișierul de test al modalului; dacă nu există
un astfel de fișier, creează-l în oglindă cu calea sursei.

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/ui/requests
```

- [ ] **Pasul 3: Scrie implementarea**

Înlocuiește:

```tsx
                  Se vor trimite <strong>{selectedQuestions.length} emailuri separate</strong> către{' '}
```

cu:

```tsx
                  Se vor trimite{' '}
                  <strong>
                    {selectedQuestions.length}{' '}
                    {selectedQuestions.length === 1 ? 'email separat' : 'emailuri separate'}
                  </strong>{' '}
                  către{' '}
```

- [ ] **Pasul 4: Rulează ca să verifici că trece**

```bash
npx vitest run tests/unit/m544/ui/requests
```

- [ ] **Pasul 5: Poarta minimă și commit**

```bash
npm run check
git add src/manager-544/ui/requests/preview/PreviewModal.tsx tests/unit/m544/ui/requests
git commit -m "Previzualizare: acord corect pentru o singură cerere"
```

- [ ] **Pasul 6: Verificare vizuală a întregului lot**

Abia acum, o singură dată pentru Task-urile 5–9:

```bash
npm run test:browser
```

Așteptat: suita verde. Verifică manual, în ambele teme, la lățime de telefon: titlul pe un rând,
clopoţelul navigabil, meniul hamburger, cardul instituţiei.

---

# LOT 5 — textul cererii și genul

---

### Task 10: Câmpul de gen

**Findings:** F7 (partea 1).

**Files:**
- Create: `supabase/migrations/019_profile_gender.sql`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `src/manager-544/shared/types/profile.ts`

**Interfaces:**
- Produces: `profiles.gender` de tip `TEXT` cu valorile `'f' | 'm' | null`, propagată din
  `raw_user_meta_data->>'gender'` la înregistrare. `Profile.gender: 'f' | 'm' | null`.

**Atenție:** `019` este singurul număr de migrare alocat în acest val. Migrarea se aplică **manual de
owner**; nu presupune că e în DB când scrii cod care o foloseşte — tratează `gender` ca opţional.

- [ ] **Pasul 1: Scrie migrarea**

`supabase/migrations/019_profile_gender.sql`:

```sql
-- 019: genul solicitantului, pentru acordul gramatical din cererile 544.
--
-- Textul cererii scrie „Subsemnatul" / „Subsemnata"; fără câmpul ăsta, formularea era greşită
-- pentru jumătate dintre utilizatori (raportul de testare din 2026-09-22).
-- Rămâne NULL pentru conturile existente; şablonul foloseşte „Subsemnatul/Subsemnata" atunci.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('f', 'm'));

COMMENT ON COLUMN public.profiles.gender IS
  'f | m | NULL — folosit doar pentru acordul gramatical din cererile 544.';

-- Propagă genul din metadatele de înregistrare, ca numele în 005.
CREATE OR REPLACE FUNCTION public.sync_profile_gender()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'gender' IN ('f', 'm') THEN
    UPDATE public.profiles
       SET gender = NEW.raw_user_meta_data->>'gender'
     WHERE id = NEW.id AND gender IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_gender ON auth.users;
CREATE TRIGGER on_auth_user_gender
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_gender();
```

- [ ] **Pasul 2: Adaugă câmpul în tip**

În `src/manager-544/shared/types/profile.ts`, adaugă în interfaţa `Profile`:

```ts
  /** 'f' | 'm' | null — doar pentru acordul gramatical din cererile 544. */
  gender: 'f' | 'm' | null;
```

- [ ] **Pasul 3: Adaugă câmpul în formularul de înregistrare**

În `app/(auth)/register/page.tsx`, adaugă starea:

```tsx
  const [gender, setGender] = useState<'f' | 'm' | ''>('')
```

validarea, după cea de nume:

```tsx
    if (gender !== 'f' && gender !== 'm') {
      setError('Selectează forma de adresare.')
      return
    }
```

metadata trimisă la `signUp`:

```tsx
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender,
        },
```

și, în formular, imediat sub câmpurile de nume:

```tsx
            <div className="space-y-2">
              <Label htmlFor="gender">Formă de adresare</Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'f' | 'm' | '')}
                required
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Alege…</option>
                <option value="f">Doamnă — „Subsemnata"</option>
                <option value="m">Domn — „Subsemnatul"</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Folosită doar pentru acordul gramatical din cererile trimise instituțiilor.
              </p>
            </div>
```

- [ ] **Pasul 4: Poarta minimă**

```bash
npm run check
```

- [ ] **Pasul 5: Commit**

```bash
git add supabase/migrations/019_profile_gender.sql \
        src/manager-544/shared/types/profile.ts \
        "app/(auth)/register/page.tsx"
git commit -m "Profil: câmp de gen la înregistrare, pentru acordul din cererile 544"
```

- [ ] **Pasul 6: Semnalează owner-ului**

Migrarea `019` trebuie aplicată manual. Spune-i explicit owner-ului în raport.

---

### Task 11: Textul cererii

**Findings:** F7 (părțile 2–4).

**Files:**
- Modify: `src/manager-544/requests/email-template.ts`
- Modify: `src/manager-544/requests/utils/question-extraction.ts`
- Modify: `tests/unit/m544/requests/email-template.test.ts`
- Modify: `tests/unit/m544/requests/question-extraction.test.ts`
- Modify: `src/manager-544/ui/requests/wizard/types.ts` (câmpul `solicitantGender`)

**Interfaces:**
- Consumes: `Profile.gender` din Task 10.
- Produces: `EmailTemplateData` primeşte `solicitantGender?: 'f' | 'm' | null`.

**ATENȚIE — motivul pentru care cele două fișiere se modifică în același commit.**
`question-extraction.ts` depinde de formulările fixe ale șablonului în două locuri distincte:

1. `LONG_FORM_PATTERN` (linia 21) ancorează pe „…privind liberul acces la informațiile de interes
   public:" și se oprește la `Aștept|Astept|Cu stimă|Vă mulțumesc`. Șablonul nou **păstrează**
   ambele ancore, deci extragerea principală continuă să funcționeze — verifică asta, nu o presupune.
2. `PENALTY_PATTERNS` (liniile 12-15) conține `/datele de contact/i`, care penalizează linia de
   boilerplate în fallback-ul pe scor. Cu formularea nouă, penalizarea **nu mai prinde**, deci
   boilerplate-ul poate fi ales drept „întrebare" atunci când ancora principală lipsește.

Cererile deja trimise conțin formularea veche, deci tiparele vechi **rămân**; se adaugă cele noi
lângă ele.

- [ ] **Pasul 1: Scrie testele care pică**

În `tests/unit/m544/requests/email-template.test.ts`:

```ts
  it('foloseşte „Subsemnata" pentru o solicitantă', () => {
    const text = formatEmailBodyText('Întrebarea mea?', { ...data, solicitantGender: 'f' });
    expect(text).toContain('Subsemnata Irina Bogdan, cu domiciliul în Str. Vampir 9,');
    expect(text).not.toContain('Subsemnatul Irina');
  });

  it('foloseşte „Subsemnatul" pentru un solicitant', () => {
    const text = formatEmailBodyText('Întrebarea mea?', { ...data, solicitantGender: 'm' });
    expect(text).toContain('Subsemnatul Ion Popescu, cu domiciliul în');
  });

  it('foloseşte forma dublă când genul lipseşte (conturi create înainte de migrarea 019)', () => {
    const text = formatEmailBodyText('Întrebarea mea?', { ...data, solicitantGender: null });
    expect(text).toContain('Subsemnatul/Subsemnata');
  });

  it('se adresează invariabil, fără acord cu numele instituţiei', () => {
    const text = formatEmailBodyText('Întrebarea mea?', data);
    expect(text).toContain('Stimată doamnă/Stimate domn,');
    expect(text).not.toContain('Stimate reprezentant al');
  });

  it('separă mulţumirile de propoziţia cu adresa de răspuns', () => {
    const lines = emailBodyLines('Întrebarea mea?', data);
    const multumesc = lines.find((l) => l.includes('mulțumesc'));
    expect(multumesc).toBe('Vă mulțumesc anticipat pentru cooperare.');
    expect(lines.some((l) => l.includes('Aștept cu interes răspunsul') && l.includes('mulțumesc'))).toBe(false);
  });
```

În `tests/unit/m544/requests/question-extraction.test.ts` (funcția se numește
`extractTemplateQuestion` — verificat în sursă; nu o redenumi):

```ts
  it('extrage întrebarea din formularea nouă', () => {
    const corp = [
      'Stimată doamnă/Stimate domn,',
      '',
      'Subsemnata Irina Bogdan, cu domiciliul în Str. Vampir 9, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:',
      '',
      'Care este bugetul pe 2026?',
      '',
      'Aștept cu interes răspunsul dumneavoastră la adresa de email irina@example.ro.',
    ].join('\n');
    expect(extractTemplateQuestion(corp)).toBe('Care este bugetul pe 2026?');
  });

  it('extrage în continuare din formularea veche (cereri deja trimise)', () => {
    const corp = [
      'Stimate reprezentant al Primăriei,',
      '',
      'Subsemnatul Ion Popescu, cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:',
      '',
      'Care este bugetul pe 2025?',
      '',
      'Aștept cu interes răspunsul dumneavoastră la adresa de email ion@example.ro și vă mulțumesc anticipat pentru cooperare.',
    ].join('\n');
    expect(extractTemplateQuestion(corp)).toBe('Care este bugetul pe 2025?');
  });

  it('nu confundă linia de boilerplate cu întrebarea, în formularea nouă', () => {
    // Fără ancora „…interes public:", extragerea cade pe scorul pe linii. Linia care începe cu
    // „Subsemnata … cu domiciliul în …" trebuie penalizată, ca înainte cea cu „datele de contact".
    const linii = extractKeyLines(
      'Subsemnata Irina Bogdan, cu domiciliul în Str. Vampir 9, vă adresez următoarea solicitare.\nCare este bugetul pe 2026?',
    );
    expect(linii.join(' ')).not.toContain('cu domiciliul în');
  });
```

**Notă:** `extractKeyLines` are o semnătură cu parametri opţionali — citeşte-o în sursă și
cheam-o cum trebuie.

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/requests
```

- [ ] **Pasul 3: Rescrie şablonul**

În `src/manager-544/requests/email-template.ts`, adaugă în `EmailTemplateData`:

```ts
  /** Pentru acordul lui „Subsemnatul/Subsemnata". Lipseşte la conturile de dinainte de 019. */
  solicitantGender?: 'f' | 'm' | null;
```

și înlocuiește `emailBodyLines` cu:

```ts
/**
 * Formula de deschidere e invariabilă. „Stimate reprezentant al {instituţie}" cerea acordul cu
 * numele instituţiei şi ieşea greşit pentru cele feminine („al Agenția") — raportul de testare
 * din 2026-09-22.
 */
const SALUT = 'Stimată doamnă/Stimate domn,';

function subsemnatul(gender: EmailTemplateData['solicitantGender']): string {
  if (gender === 'f') return 'Subsemnata';
  if (gender === 'm') return 'Subsemnatul';
  return 'Subsemnatul/Subsemnata';
}

export function emailBodyLines(question: string, data: EmailTemplateData): string[] {
  return [
    `Solicitant: ${data.solicitantName}`,
    `Adresa: ${data.solicitantAddress}`,
    `Email: ${data.solicitantEmail}`,
    '',
    SALUT,
    '',
    // „cu domiciliul în X" este formularea uzuală în cererile 544; „cu datele de contact
    // menţionate mai sus" nu apare în niciun model oficial.
    `${subsemnatul(data.solicitantGender)} ${data.solicitantName}, cu domiciliul în ${data.solicitantAddress}, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:`,
    '',
    question,
    '',
    `Aștept cu interes răspunsul dumneavoastră la adresa de email ${data.solicitantEmail}.`,
    '',
    'Vă mulțumesc anticipat pentru cooperare.',
    '',
    '',
    'Cu stimă,',
    data.solicitantName,
  ];
}
```

Actualizează și comentariul de antet al fişierului: markerii pe care se bazează extragerea sunt acum
„Solicitare … :" și „Aștept".

- [ ] **Pasul 4: Fă extragerea tolerantă la ambele formulări**

În `src/manager-544/requests/utils/question-extraction.ts`, extinde `PENALTY_PATTERNS`
(liniile 12-15) — **fără să ştergi nimic**, fiindcă cererile deja trimise conţin formularea veche:

```ts
const PENALTY_PATTERNS = [
  /^(solicitant|adres[ăa]|email|telefon|cu st(?:ime|imă)|mulțumesc|cooperare)/i,
  // Linia de boilerplate a şablonului, în ambele formulări: cea veche („cu datele de contact
  // menţionate mai sus") şi cea de după 2026-09-22 („cu domiciliul în …").
  /datele de contact/i,
  /cu domiciliul în/i,
  /^v[ăa] mulțumesc/i,
  /^stimat[ăe] doamn[ăa]\/stimate domn/i,
];
```

`LONG_FORM_PATTERN` **nu se modifică**: ancorează pe „…privind liberul acces la informațiile de
interes public:" și se oprește la „Aștept", iar şablonul nou păstrează ambele.

- [ ] **Pasul 5: Propagă genul până la şablon**

```bash
grep -rn "solicitantAddress" --include=*.ts --include=*.tsx src | grep -v test
```

Pentru fiecare loc care construieşte `EmailTemplateData` (wizard, previzualizare, trimitere), adaugă
`solicitantGender` din profil. În `src/manager-544/ui/requests/wizard/types.ts`, lângă
`solicitantAddress`, adaugă:

```ts
  solicitantGender?: 'f' | 'm' | null;
```

- [ ] **Pasul 6: Rulează testele**

```bash
npx vitest run tests/unit/m544/requests tests/unit/m544/pipeline
```

Așteptat: PASS. Dacă pică teste de clasificare sau de extragere pe corpuri vechi, formularea veche
nu mai e recunoscută — întoarce-te la Pasul 4.

- [ ] **Pasul 7: Poarta minimă și commit**

```bash
npm run check
git add src/manager-544/requests/email-template.ts \
        src/manager-544/requests/utils/question-extraction.ts \
        src/manager-544/ui/requests/wizard/types.ts \
        tests/unit/m544/requests/email-template.test.ts \
        tests/unit/m544/requests/question-extraction.test.ts
git commit -m "Cerere 544: acord pe gen, domiciliu, salut invariabil, mulţumiri separate"
```

---

### Task 12: Email de confirmare la aprobarea contului

**Findings:** F9.

**Files:**
- Create: `src/manager-544/admin/approval-email.ts`
- Create: `tests/unit/m544/admin/approval-email.test.ts`
- Modify: `src/manager-544/admin/users.ts:43-45`
- Modify: `src/manager-544/admin/handlers.ts`
- Modify: `tests/unit/m544/admin/users.test.ts`

**Interfaces:**
- Consumes: `AdminUsersRepo.getAuthEmail(id)` (există), tiparul de trimitere din
  `notifications/deps.ts` (`sender.send(payload: OutgoingEmail)`, `fromAddress`).
- Produces: `buildApprovalEmail(ctx: { displayName: string; appUrl: string }): { subject: string; html: string; text: string }`.

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/m544/admin/approval-email.test.ts`:

```ts
/**
 * Emailul trimis la aprobarea contului. Până la raportul de testare din 2026-09-22, aprobarea
 * era tăcută: utilizatorul rămânea pe /pending-approval fără să afle că poate intra.
 */
import { describe, it, expect } from 'vitest';
import { buildApprovalEmail } from '@m544/admin/approval-email';

describe('buildApprovalEmail', () => {
  const ctx = { displayName: 'Irina', appUrl: 'https://implicarecivica.ro' };

  it('are un subiect care spune ce s-a întâmplat', () => {
    expect(buildApprovalEmail(ctx).subject).toBe('Contul tău Implicare Civică a fost aprobat');
  });

  it('se adresează pe nume şi conţine linkul de intrare', () => {
    const email = buildApprovalEmail(ctx);
    expect(email.text).toContain('Irina');
    expect(email.text).toContain('https://implicarecivica.ro/login');
    expect(email.html).toContain('https://implicarecivica.ro/login');
  });

  it('funcţionează fără nume', () => {
    const email = buildApprovalEmail({ ...ctx, displayName: '' });
    expect(email.text).toContain('Salut,');
    expect(email.text).not.toContain('Salut ,');
  });

  it('escapează numele în HTML', () => {
    const email = buildApprovalEmail({ ...ctx, displayName: '<script>x</script>' });
    expect(email.html).not.toContain('<script>');
  });
});
```

- [ ] **Pasul 2: Rulează ca să verifici că pică**

```bash
npx vitest run tests/unit/m544/admin/approval-email.test.ts
```

- [ ] **Pasul 3: Scrie conţinutul emailului**

`src/manager-544/admin/approval-email.ts`:

```ts
/**
 * Emailul de confirmare trimis când un administrator aprobă un cont.
 *
 * Conţinut pur: nicio dependenţă de transport, ca să poată fi verificat fără Resend. Trimiterea
 * propriu-zisă e în `users.ts`, cu acelaşi tipar ca digestul de termene.
 */
import { escapeHtml } from '@m544/notifications/template';

export interface ApprovalEmailContext {
  displayName: string;
  appUrl: string;
}

export interface ApprovalEmail {
  subject: string;
  html: string;
  text: string;
}

export const APPROVAL_SUBJECT = 'Contul tău Implicare Civică a fost aprobat';

export function buildApprovalEmail({ displayName, appUrl }: ApprovalEmailContext): ApprovalEmail {
  const nume = displayName.trim();
  const salut = nume ? `Salut, ${nume},` : 'Salut,';
  const login = `${appUrl.replace(/\/+$/, '')}/login`;

  const text = [
    salut,
    '',
    'Contul tău a fost aprobat. Poți intra în platformă și poți trimite cereri de informații',
    'publice în baza Legii 544/2001.',
    '',
    login,
    '',
    'Cu stimă,',
    'Echipa Implicare Civică',
  ].join('\n');

  const html = [
    `<p>${escapeHtml(salut)}</p>`,
    '<p>Contul tău a fost aprobat. Poți intra în platformă și poți trimite cereri de informații publice în baza Legii 544/2001.</p>',
    `<p><a href="${escapeHtml(login)}">Intră în cont</a></p>`,
    '<p>Cu stimă,<br>Echipa Implicare Civică</p>',
  ].join('\n');

  return { subject: APPROVAL_SUBJECT, html, text };
}
```

- [ ] **Pasul 4: Rulează ca să verifici că trece**

```bash
npx vitest run tests/unit/m544/admin/approval-email.test.ts
```

- [ ] **Pasul 5: Trimite emailul la aprobare**

În `src/manager-544/admin/users.ts`, înlocuieşte:

```ts
export function approveUser(repo: AdminUsersRepo, userId: string): Promise<void> {
  return repo.setApproved(userId, true);
}
```

cu:

```ts
export interface ApprovalNotifier {
  send(to: string, email: ApprovalEmail): Promise<void>;
}

/**
 * Aprobarea nu eşuează dacă emailul nu pleacă: contul e deja aprobat în acel moment, iar un
 * administrator care vede „eroare" ar reîncerca şi ar trimite al doilea email.
 */
export async function approveUser(
  repo: AdminUsersRepo,
  userId: string,
  notifier?: ApprovalNotifier,
  appUrl = 'https://implicarecivica.ro',
): Promise<void> {
  await repo.setApproved(userId, true);
  if (!notifier) return;
  try {
    const email = await repo.getAuthEmail(userId);
    if (!email) return;
    const profile = (await repo.listUnapprovedProfiles()).find((p) => p.id === userId);
    await notifier.send(email, buildApprovalEmail({ displayName: profile?.display_name ?? '', appUrl }));
  } catch (err) {
    console.error(`[Admin] Aprobare ${userId}: emailul de confirmare nu a plecat:`, err);
  }
}
```

**Notă pentru implementator:** `listUnapprovedProfiles()` nu mai conţine utilizatorul după
`setApproved`. Citeşte numele **înainte** de aprobare, sau adaugă o metodă `getProfile(id)` în
`AdminUsersRepo` — alege varianta care se potriveşte cu repo-ul real și actualizează şi
`supabase-repos.ts`. Nu lăsa un apel care întoarce mereu `undefined`.

- [ ] **Pasul 6: Leagă transportul**

În `src/manager-544/admin/handlers.ts`, la crearea handlerului de aprobare, injectează un notifier
construit ca în `notifications/deps.ts`:

```ts
const notifier: ApprovalNotifier = {
  async send(to, email) {
    const result = await getResend().emails.send({
      from: `Implicare Civică <notificari@${optionalEnv('NEXT_PUBLIC_EMAIL_DOMAIN', 'implicarecivica.ro')}>`,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (result.error) throw new Error(`Resend: ${result.error.message}`);
  },
};
```

- [ ] **Pasul 7: Rulează testele de admin**

```bash
npx vitest run tests/unit/m544/admin tests/unit/m544/routes
```

Așteptat: PASS. Testele existente care cheamă `approveUser(repo, id)` cu două argumente trebuie să
treacă neschimbate — de aceea notifier-ul e opţional.

- [ ] **Pasul 8: Poarta minimă și commit**

```bash
npm run check
git add src/manager-544/admin/approval-email.ts \
        tests/unit/m544/admin/approval-email.test.ts \
        src/manager-544/admin/users.ts \
        src/manager-544/admin/handlers.ts \
        tests/unit/m544/admin/users.test.ts
git commit -m "Admin: confirmare pe email la aprobarea contului"
```

---

## Verificarea finală, după toate loturile

- [ ] `npm run check` pe arborele integrat
- [ ] `npm run test:browser` o singură dată
- [ ] Migrarea `019` semnalată owner-ului (`018` e deja aplicată)
- [ ] Backfill-ul termenelor aplicat și verificat pe cererea din raport
- [ ] Recitit raportul de testare punct cu punct, față de aplicația pornită

## Ce rămâne în afara acestui plan

- **Bifurcația la începutul sesiunii de cereri** („știu deja instituția și întrebările" vs. „am nevoie
  de ajutor") — cere brainstorming separat; atinge wizardul, hand-off-ul din chat și regula de
  verificare online a adresei instituției.
- **Atașamente** la cerere — bucket, limite, `attachments` în Resend, afișare în firul cererii.
- **Denumirile trunchiate semantic** ale template-urilor („Consiliul Local al", „Primăria") — listă de
  nume de afișare per template, muncă de conținut.
- **Statusurile `delayed` puse greșit** de aritmetica veche — backfill-ul nu le atinge, deliberat.
