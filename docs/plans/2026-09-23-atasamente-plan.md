# Atașamente pe întrebare — plan de implementare

> **Pentru agenți:** SUB-SKILL OBLIGATORIU: `superpowers:subagent-driven-development` (recomandat) sau
> `superpowers:executing-plans`. Pașii folosesc checkbox (`- [ ]`).

**Scop:** fiecare întrebare a unei cereri 544 poate avea imagini sau PDF-uri atașate, care pleacă la
instituție odată cu emailul acelei întrebări și apar apoi în firul cererii.

**Arhitectură:** browserul urcă fișierul direct în bucket-ul `email-attachments` (RLS existent), sub
`<uid>/outgoing/<id>/<nume>`; întrebarea poartă referința. La trimitere, `/api/emails/send` primește
căile, descarcă fișierele **cu clientul Supabase al utilizatorului**, le verifică pe octeți și le
trimite prin Resend. Rândul emailului trimis salvează metadatele cu `path`, deci afișarea din fir
funcționează fără schimbări.

**Tech stack:** Next.js App Router, TypeScript, Supabase Storage, Resend SDK 6.9.3, Vitest + jsdom, Playwright.

**Spec:** [2026-09-23-atasamente-design.md](2026-09-23-atasamente-design.md) — planul argumentează din ea.

## Constrângeri globale

- Tipuri acceptate: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Nimic altceva.
- Maximum **10 MB pe fișier**, **20 MB pe întrebare**, **5 fișiere pe întrebare**.
- Limitele se verifică în browser **și** pe server; pe server tipul se stabilește după octeți, nu după MIME-ul declarat.
- Serverul descarcă atașamentele **numai** cu clientul de sesiune al utilizatorului (RLS), niciodată cu clientul de service.
- Un atașament care nu poate fi descărcat sau nu trece verificarea **oprește emailul întrebării respective**. Nu se trimite niciodată, tăcut, o cerere fără fișierul atașat.
- **Nicio migrare.** Bucket-ul, RLS-ul și coloana `emails.attachments` există (`supabase/migrations/004_emails.sql`).
- Regulile din `CLAUDE.md` se aplică integral: fără `git add -A`; `@testing-library/jest-dom` și `@testing-library/user-event` **nu** sunt instalate (aserțiuni pe DOM, `fireEvent`); jsdom n-are `window.matchMedia`; `vi.mock` doar pentru `next/navigation`; româna cu diacritice în interfață.
- Poarta `npm run check` înainte de commit. În execuția cu subagenți, poarta și commit-urile le face orchestratorul.

## Review Focus

Cazuri pe care specificația le implică, dar niciun test „evident" nu le prinde. Fiecare are testul lui
adăugat în task-ul care deține codul:

1. **Mărimea declarată minte** (browserul spune 1 KB, fișierul are 30 MB) → serverul respinge după mărimea reală. *Task 2.*
2. **Nume de fișier cu separatori de cale, `..` sau diacritice** → calea rămâne sub `<uid>/outgoing/<id>/`, iar numele e curățat. *Task 1.*
3. **Atașamentul întrebării 2 din 3 lipsește la trimitere** → întrebările 1 și 3 pleacă, iar eșecul 2 e vizibil, cu motivul. *Task 6.*
4. **„Previzualizează" apăsat cât timp un fișier se încarcă sau a eșuat** → butonul e blocat. *Task 3.*
5. **Același fișier atașat de două ori** (pe aceeași întrebare sau pe două) → două căi distincte, nicio suprascriere. *Task 3.*

---

## Ordinea și paralelismul

`Task 1` → apoi **în paralel** `Task 2` (server), `Task 3` (upload + starea wizard-ului), `Task 6` (coada)
— fișiere disjuncte → `Task 4` → `Task 5` → `Task 7`.

---

### Task 1: Modulul pur al atașamentelor

**Files:**
- Create: `src/manager-544/requests/attachments.ts`
- Create: `tests/unit/m544/requests/attachments.test.ts`
- Modify: `src/manager-544/ui/requests/wizard/types.ts` (interfața `QuestionItem`, liniile 37-43)
- Modify: `src/manager-544/shared/types/email.ts:23`

**Interfaces:**
- Produces (folosite de toate task-urile următoare):
  - `interface OutgoingAttachment { path: string; name: string; type: string; size: number }`
  - `ALLOWED_ATTACHMENT_TYPES`, `type AllowedAttachmentType`, `ATTACHMENT_ACCEPT: string`
  - `MAX_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024`, `MAX_ATTACHMENTS_BYTES_PER_QUESTION = 20 * 1024 * 1024`, `MAX_ATTACHMENTS_PER_QUESTION = 5`
  - `formatMb(bytes: number): string`
  - `outgoingPrefix(userId: string): string` → `` `${userId}/outgoing/` ``
  - `outgoingPath(userId: string, id: string, filename: string): string`
  - `checkNewAttachment(existing: readonly { size: number }[], file: { name: string; type: string; size: number }): string | null`
  - `checkDeclaredAttachments(userId: string, list: readonly OutgoingAttachment[]): string | null`
  - `sniffAttachmentType(bytes: Uint8Array): AllowedAttachmentType | null`
  - `QuestionItem.attachments?: OutgoingAttachment[]`

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/m544/requests/attachments.test.ts`:

```ts
/**
 * Verificările comune browserului şi serverului pentru ataşamentele unei întrebări.
 * Spec: docs/plans/2026-09-23-atasamente-design.md §4.1-4.2.
 */
import { describe, it, expect } from 'vitest';
import {
  checkDeclaredAttachments,
  checkNewAttachment,
  formatMb,
  MAX_ATTACHMENT_FILE_BYTES,
  MAX_ATTACHMENTS_BYTES_PER_QUESTION,
  MAX_ATTACHMENTS_PER_QUESTION,
  outgoingPath,
  sniffAttachmentType,
  type OutgoingAttachment,
} from '@m544/requests/attachments';

const MB = 1024 * 1024;
const att = (over: Partial<OutgoingAttachment> = {}): OutgoingAttachment => ({
  path: 'u1/outgoing/id1/doc.pdf',
  name: 'doc.pdf',
  type: 'application/pdf',
  size: 1 * MB,
  ...over,
});

describe('outgoingPath', () => {
  it('pune fişierul sub folderul RLS al utilizatorului', () => {
    expect(outgoingPath('u1', 'id1', 'Răspuns 544.pdf')).toBe('u1/outgoing/id1/Răspuns 544.pdf');
  });

  it('nu lasă numele să iasă din folder (Review Focus 2)', () => {
    const p = outgoingPath('u1', 'id1', '../../u2/outgoing/x/evil.pdf');
    expect(p.startsWith('u1/outgoing/id1/')).toBe(true);
    expect(p.split('/')).not.toContain('..');
  });
});

describe('checkNewAttachment', () => {
  it('acceptă o imagine în limite', () => {
    expect(checkNewAttachment([], { name: 'groapa.jpg', type: 'image/jpeg', size: 2 * MB })).toBeNull();
  });

  it('refuză un tip neacceptat', () => {
    expect(checkNewAttachment([], { name: 'a.docx', type: 'application/msword', size: 10 })).toMatch(/nu e acceptat/);
  });

  it('refuză un fişier peste 10 MB', () => {
    expect(
      checkNewAttachment([], { name: 'mare.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_FILE_BYTES + 1 }),
    ).toMatch(/pe fișier/);
  });

  it('refuză al şaselea fişier', () => {
    const existing = Array.from({ length: MAX_ATTACHMENTS_PER_QUESTION }, () => ({ size: 1 }));
    expect(checkNewAttachment(existing, { name: 'x.png', type: 'image/png', size: 1 })).toMatch(/Cel mult 5/);
  });

  it('refuză depăşirea celor 20 MB pe întrebare', () => {
    const existing = [{ size: 9 * MB }, { size: 9 * MB }];
    expect(checkNewAttachment(existing, { name: 'x.pdf', type: 'application/pdf', size: 3 * MB })).toMatch(/pe întrebare/);
    expect(MAX_ATTACHMENTS_BYTES_PER_QUESTION).toBe(20 * MB);
  });
});

describe('checkDeclaredAttachments', () => {
  it('acceptă ataşamente proprii în limite', () => {
    expect(checkDeclaredAttachments('u1', [att()])).toBeNull();
  });

  it('refuză o cale din folderul altcuiva', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u2/outgoing/id1/doc.pdf' })])).toMatch(/nepermis/);
  });

  it('refuză o cale în afara lui outgoing/', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u1/e9/raspuns.pdf' })])).toMatch(/nepermis/);
  });

  it('refuză segmentele „..", dar nu un nume care conţine două puncte', () => {
    expect(checkDeclaredAttachments('u1', [att({ path: 'u1/outgoing/../u2/x.pdf' })])).toMatch(/nepermis/);
    expect(checkDeclaredAttachments('u1', [att({ path: 'u1/outgoing/id1/raport..final.pdf' })])).toBeNull();
  });

  it('refuză mai mult de 5 fişiere şi peste 20 MB declaraţi', () => {
    expect(checkDeclaredAttachments('u1', Array.from({ length: 6 }, () => att({ size: 1 })))).toMatch(/Cel mult 5/);
    expect(checkDeclaredAttachments('u1', [att({ size: 15 * MB }), att({ size: 6 * MB })])).toMatch(/pe întrebare/);
  });
});

describe('sniffAttachmentType', () => {
  const bytes = (...b: number[]) => Uint8Array.from(b);

  it('recunoaşte PDF, JPEG, PNG şi WebP după primii octeţi', () => {
    expect(sniffAttachmentType(new TextEncoder().encode('%PDF-1.4'))).toBe('application/pdf');
    expect(sniffAttachmentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffAttachmentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffAttachmentType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });

  it('întoarce null pentru orice altceva, inclusiv un executabil redenumit .pdf', () => {
    expect(sniffAttachmentType(new TextEncoder().encode('MZ\x90\0'))).toBeNull();
    expect(sniffAttachmentType(new Uint8Array(0))).toBeNull();
  });
});

describe('formatMb', () => {
  it('scrie cu virgulă zecimală', () => {
    expect(formatMb(2.5 * MB)).toBe('2,5 MB');
  });
});
```

- [ ] **Pasul 2: Rulează testul — trebuie să pice**

```bash
npx vitest run tests/unit/m544/requests/attachments.test.ts
```

Așteptat: FAIL — `Failed to resolve import "@m544/requests/attachments"`.

- [ ] **Pasul 3: Scrie implementarea**

`src/manager-544/requests/attachments.ts`:

```ts
/**
 * Ataşamentele unei întrebări dintr-o cerere 544: tipul, limitele şi verificările comune
 * browserului (la alegere) şi serverului (la trimitere). Modul pur, fără I/O — rulează în ambele.
 *
 * Limitele vin din Resend: 40 MB pe email, măsuraţi DUPĂ codarea base64 (+~33%). 20 MB bruţi
 * pe întrebare ajung la ~27 MB, cu loc pentru corpul emailului.
 * Spec: docs/plans/2026-09-23-atasamente-design.md
 */
import { safeFilename } from '@m544/inbound/webhook/attachments';

export interface OutgoingAttachment {
  /** `<uid>/outgoing/<id>/<nume>` — primul segment e folderul RLS al bucket-ului. */
  path: string;
  name: string;
  /** Pe client: MIME-ul declarat de browser. Pe server se înlocuieşte cu tipul citit din octeţi. */
  type: string;
  size: number;
}

export const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];
/** Pentru `<input accept>`: pe iOS, cererea explicită de JPEG face Safari să convertească HEIC. */
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(',');

const MB = 1024 * 1024;
export const MAX_ATTACHMENT_FILE_BYTES = 10 * MB;
export const MAX_ATTACHMENTS_BYTES_PER_QUESTION = 20 * MB;
export const MAX_ATTACHMENTS_PER_QUESTION = 5;

export function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

export function outgoingPrefix(userId: string): string {
  return `${userId}/outgoing/`;
}

/** `safeFilename` taie directoarele, deci un nume ca `../../x.pdf` nu poate ieşi din folder. */
export function outgoingPath(userId: string, id: string, filename: string): string {
  return `${outgoingPrefix(userId)}${id}/${safeFilename(filename)}`;
}

function isAllowedType(type: string): type is AllowedAttachmentType {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(type);
}

const sumSizes = (list: readonly { size: number }[]) => list.reduce((total, a) => total + a.size, 0);

const tooMany = () => `Cel mult ${MAX_ATTACHMENTS_PER_QUESTION} fișiere pe întrebare.`;
const tooBigTotal = (total: number) =>
  `Împreună, fișierele au ${formatMb(total)}; maximum ${formatMb(MAX_ATTACHMENTS_BYTES_PER_QUESTION)} pe întrebare.`;

/** Browser: null când `file` se poate adăuga lângă `existing`; altfel motivul, pentru om. */
export function checkNewAttachment(
  existing: readonly { size: number }[],
  file: { name: string; type: string; size: number },
): string | null {
  if (!isAllowedType(file.type)) return `„${file.name}” nu e acceptat: doar imagini JPEG, PNG, WebP sau PDF.`;
  if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
    return `„${file.name}” are ${formatMb(file.size)}; maximum ${formatMb(MAX_ATTACHMENT_FILE_BYTES)} pe fișier.`;
  }
  if (existing.length >= MAX_ATTACHMENTS_PER_QUESTION) return tooMany();
  const total = sumSizes(existing) + file.size;
  if (total > MAX_ATTACHMENTS_BYTES_PER_QUESTION) return tooBigTotal(total);
  return null;
}

/**
 * Server, înainte de orice descărcare: ce a declarat clientul trebuie să stea în folderul
 * utilizatorului şi în limite. Mărimea şi tipul REALE se verifică după descărcare.
 */
export function checkDeclaredAttachments(userId: string, list: readonly OutgoingAttachment[]): string | null {
  if (list.length > MAX_ATTACHMENTS_PER_QUESTION) return tooMany();
  for (const a of list) {
    const segments = a.path.split('/');
    if (!a.path.startsWith(outgoingPrefix(userId)) || segments.includes('..') || segments.includes('.')) {
      return `Fișier nepermis: „${a.name}”.`;
    }
  }
  const total = sumSizes(list);
  if (total > MAX_ATTACHMENTS_BYTES_PER_QUESTION) return tooBigTotal(total);
  return null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

/** Tipul real, după primii octeţi; null pentru orice altceva, oricum s-ar numi fişierul. */
export function sniffAttachmentType(bytes: Uint8Array): AllowedAttachmentType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'; // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}
```

În `src/manager-544/ui/requests/wizard/types.ts`, adaugă importul și câmpul:

```ts
import type { OutgoingAttachment } from '@m544/requests/attachments';
```

```ts
export interface QuestionItem {
  id: string;
  category: QuestionCategory;
  text: string;
  isCustom: boolean;
  isEdited: boolean;
  /** Fişiere urcate deja în storage, care pleacă ataşate la emailul acestei întrebări. */
  attachments?: OutgoingAttachment[];
}
```

În `src/manager-544/shared/types/email.ts:23`, lărgește tipul (cele primite și componenta de afișare folosesc deja `path`):

```ts
  attachments?: { name: string; size: number; type: string; path?: string }[];
```

- [ ] **Pasul 4: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/requests/attachments.test.ts && npx tsc --noEmit
```

Așteptat: PASS, `tsc` fără erori.

- [ ] **Pasul 5: Commit** (orchestratorul, după `npm run check`)

```bash
git commit --only src/manager-544/requests/attachments.ts tests/unit/m544/requests/attachments.test.ts \
  src/manager-544/ui/requests/wizard/types.ts src/manager-544/shared/types/email.ts \
  -m "Ataşamente: tipul, limitele şi verificările comune browser/server"
```

---

### Task 2: Serverul trimite atașamentele

**Files:**
- Create: `src/manager-544/emails/outgoing-attachments.ts`
- Create: `tests/unit/m544/emails/outgoing-attachments.test.ts`
- Modify: `src/manager-544/emails/send.ts` (tipul `OutgoingEmail`, `SendEmailDeps`, `bodySchema`, handler-ul, `createSendEmailDeps`)
- Modify: `src/manager-544/emails/store.ts` (`SentEmailRow`)
- Modify: `app/api/emails/send/route.ts`
- Modify: `tests/unit/m544/emails/send.test.ts`

**Interfaces:**
- Consumes: `OutgoingAttachment`, `checkDeclaredAttachments`, `sniffAttachmentType`, limitele — din Task 1. `StorageRepo` din `@m544/shared/db/storage-repo`.
- Produces:
  - `/api/emails/send` acceptă `attachments?: OutgoingAttachment[]` în corp.
  - La eroare de atașament: HTTP 400, `{ error: string }`, mesajul numind fișierul.
  - `loadAttachments(list: readonly OutgoingAttachment[], storage: Pick<StorageRepo, 'download'>): Promise<LoadedAttachments>`

- [ ] **Pasul 1: Scrie testul care pică — încărcarea**

`tests/unit/m544/emails/outgoing-attachments.test.ts`:

```ts
/**
 * Descărcarea şi verificarea ataşamentelor înainte de trimitere. Octeţii decid tipul şi
 * mărimea, nu ce a declarat browserul.
 */
import { describe, it, expect } from 'vitest';
import { loadAttachments } from '@m544/emails/outgoing-attachments';
import type { OutgoingAttachment } from '@m544/requests/attachments';

const PDF = new TextEncoder().encode('%PDF-1.4 test');
const att = (over: Partial<OutgoingAttachment> = {}): OutgoingAttachment => ({
  path: 'u1/outgoing/id1/doc.pdf',
  name: 'doc.pdf',
  type: 'application/pdf',
  size: PDF.byteLength,
  ...over,
});
const storage = (files: Record<string, Uint8Array>) => ({ download: async (p: string) => files[p] ?? null });

describe('loadAttachments', () => {
  it('descarcă, stabileşte tipul după octeţi şi păstrează calea pentru metadate', async () => {
    const r = await loadAttachments([att({ type: 'image/png' })], storage({ 'u1/outgoing/id1/doc.pdf': PDF }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.files[0].contentType).toBe('application/pdf');
    expect(r.files[0].content.equals(Buffer.from(PDF))).toBe(true);
    expect(r.files[0].meta).toEqual({ path: 'u1/outgoing/id1/doc.pdf', name: 'doc.pdf', type: 'application/pdf', size: PDF.byteLength });
  });

  it('eşuează, numind fişierul, când obiectul nu mai există în storage', async () => {
    const r = await loadAttachments([att()], storage({}));
    expect(r).toEqual({ ok: false, error: expect.stringContaining('doc.pdf') });
  });

  it('eşuează pe un fişier care nu e imagine sau PDF, oricum s-ar numi', async () => {
    const exe = new TextEncoder().encode('MZ\x90\0');
    const r = await loadAttachments([att()], storage({ 'u1/outgoing/id1/doc.pdf': exe }));
    expect(r.ok).toBe(false);
  });

  it('eşuează după mărimea REALĂ, chiar dacă cea declarată e mică (Review Focus 1)', async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    const r = await loadAttachments([att({ size: 10 })], storage({ 'u1/outgoing/id1/doc.pdf': big }));
    expect(r.ok).toBe(false);
  });

  it('nu face nimic fără ataşamente', async () => {
    expect(await loadAttachments([], storage({}))).toEqual({ ok: true, files: [] });
  });
});
```

- [ ] **Pasul 2: Rulează — trebuie să pice**

```bash
npx vitest run tests/unit/m544/emails/outgoing-attachments.test.ts
```

Așteptat: FAIL — `Failed to resolve import "@m544/emails/outgoing-attachments"`.

- [ ] **Pasul 3: Implementează încărcarea**

`src/manager-544/emails/outgoing-attachments.ts`:

```ts
/**
 * Ataşamentele unei cereri, descărcate şi verificate înainte de trimitere.
 *
 * `storage` TREBUIE să fie construit pe clientul de sesiune al utilizatorului: RLS-ul bucket-ului
 * permite doar căile sub `<uid>/`, deci o cale ghicită sau modificată în cerere eşuează la
 * storage, nu la o verificare pe care am putea-o uita. Spec: docs/plans/2026-09-23-atasamente-design.md §4.4.
 */
import type { StorageRepo } from '@m544/shared/db/storage-repo';
import {
  MAX_ATTACHMENT_FILE_BYTES,
  MAX_ATTACHMENTS_BYTES_PER_QUESTION,
  sniffAttachmentType,
  type AllowedAttachmentType,
  type OutgoingAttachment,
} from '@m544/requests/attachments';

export interface LoadedAttachment {
  filename: string;
  content: Buffer;
  contentType: AllowedAttachmentType;
  /** Ce se salvează pe rândul emailului trimis: tipul şi mărimea reale, plus calea. */
  meta: OutgoingAttachment;
}

export type LoadedAttachments = { ok: true; files: LoadedAttachment[] } | { ok: false; error: string };

export async function loadAttachments(
  list: readonly OutgoingAttachment[],
  storage: Pick<StorageRepo, 'download'>,
): Promise<LoadedAttachments> {
  const files: LoadedAttachment[] = [];
  let total = 0;
  for (const a of list) {
    const bytes = await storage.download(a.path);
    if (!bytes) return { ok: false, error: `Fișierul „${a.name}” nu mai e disponibil. Atașează-l din nou.` };

    total += bytes.byteLength;
    if (bytes.byteLength > MAX_ATTACHMENT_FILE_BYTES || total > MAX_ATTACHMENTS_BYTES_PER_QUESTION) {
      return { ok: false, error: `„${a.name}” depășește limita de mărime.` };
    }
    const contentType = sniffAttachmentType(bytes);
    if (!contentType) return { ok: false, error: `„${a.name}” nu e o imagine JPEG, PNG, WebP sau un PDF.` };

    files.push({
      filename: a.name,
      content: Buffer.from(bytes),
      contentType,
      meta: { path: a.path, name: a.name, type: contentType, size: bytes.byteLength },
    });
  }
  return { ok: true, files };
}
```

- [ ] **Pasul 4: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/emails/outgoing-attachments.test.ts
```

- [ ] **Pasul 5: Scrie testele care pică — handler-ul**

În `tests/unit/m544/emails/send.test.ts`:

(a) în `interface Scenario` adaugă `files?: Record<string, Uint8Array>;`

(b) în `build()`, în obiectul `deps`, adaugă:

```ts
    attachmentStorage: () => ({ download: async (p: string) => s.files?.[p] ?? null }),
```

(c) adaugă blocul de teste (lângă cele existente pentru trimitere; `valid`, `post`, `build` sunt cele din fișier):

```ts
describe('POST /api/emails/send — ataşamente', () => {
  const PDF = new TextEncoder().encode('%PDF-1.4 test');
  const ATT = { path: 'u1/outgoing/id1/doc.pdf', name: 'doc.pdf', type: 'application/pdf', size: PDF.byteLength };

  it('trimite fişierul prin Resend şi îl salvează cu calea pe rândul emailului', async () => {
    const { handler, sb, resend } = build({ files: { [ATT.path]: PDF } });
    const res = await handler(post({ ...valid, attachments: [ATT] }));
    expect(res.status).toBe(200);

    expect(resend.sent[0].attachments).toEqual([
      { filename: 'doc.pdf', content: Buffer.from(PDF), contentType: 'application/pdf' },
    ]);
    const insert = sb.queries.find((q) => q.table === 'emails' && q.op === 'insert')!;
    expect((insert.payload as { attachments: unknown }).attachments).toEqual([ATT]);
  });

  it('nu trimite nimic când fişierul e în folderul altcuiva', async () => {
    const { handler, resend } = build({ files: { 'u2/outgoing/id1/doc.pdf': PDF } });
    const res = await handler(post({ ...valid, attachments: [{ ...ATT, path: 'u2/outgoing/id1/doc.pdf' }] }));
    expect(res.status).toBe(400);
    expect(resend.sent).toEqual([]);
  });

  it('nu trimite nimic când fişierul nu mai există — şi spune care', async () => {
    const { handler, resend } = build({ files: {} });
    const res = await handler(post({ ...valid, attachments: [ATT] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('doc.pdf');
    expect(resend.sent).toEqual([]);
  });

  it('nu trimite nimic când octeţii nu sunt ai unui PDF sau ai unei imagini', async () => {
    const { handler, resend } = build({ files: { [ATT.path]: new TextEncoder().encode('MZ\x90\0') } });
    const res = await handler(post({ ...valid, attachments: [ATT] }));
    expect(res.status).toBe(400);
    expect(resend.sent).toEqual([]);
  });

  it('fără ataşamente, payload-ul şi rândul rămân exact ca înainte', async () => {
    const { handler, sb, resend } = build();
    await handler(post(valid));
    expect(resend.sent[0]).not.toHaveProperty('attachments');
    const insert = sb.queries.find((q) => q.table === 'emails' && q.op === 'insert')!;
    expect(insert.payload).not.toHaveProperty('attachments');
  });
});
```

- [ ] **Pasul 6: Rulează — trebuie să pice**

```bash
npx vitest run tests/unit/m544/emails/send.test.ts
```

Așteptat: FAIL pe primele patru teste noi. Testul „fără atașamente" și toate testele vechi trec.

- [ ] **Pasul 7: Implementează în handler**

În `src/manager-544/emails/send.ts`:

Importuri noi:

```ts
import { SupabaseStorageRepo, type StorageRepo } from '@m544/shared/db/storage-repo';
import { checkDeclaredAttachments, MAX_ATTACHMENTS_PER_QUESTION } from '@m544/requests/attachments';
import { loadAttachments } from './outgoing-attachments';
```

`OutgoingEmail` primește un câmp opțional:

```ts
  /** Doar la cererile cu ataşamente; câmpul lipseşte altfel, ca payload-ul să rămână neschimbat. */
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
```

`SendEmailDeps` primește:

```ts
  /** Storage pe clientul de SESIUNE, ca RLS să decidă ce fişiere poate trimite utilizatorul. */
  attachmentStorage: (sb: C) => Pick<StorageRepo, 'download'>;
```

`bodySchema` primește:

```ts
  attachments: z
    .array(
      z.object({
        path: z.string().min(1),
        name: z.string().min(1),
        type: z.string().min(1),
        size: z.number().int().nonnegative(),
      }),
    )
    .max(MAX_ATTACHMENTS_PER_QUESTION)
    .optional(),
```

În handler, `const { to, subject, body, request_id, parent_email_id } = parsed.data;` devine:

```ts
    const { to, subject, body, request_id, parent_email_id, attachments = [] } = parsed.data;
```

Imediat după verificarea limitei zilnice (după `if (!limit.ok) { … }`) și **înainte** de `deps.resend.send`:

```ts
    // Un ataşament lipsă sau fals opreşte emailul: nu trimitem niciodată, tăcut, o cerere fără
    // fişierul pe care omul l-a ataşat.
    const declaredError = checkDeclaredAttachments(user.id, attachments);
    if (declaredError) return httpError(400, declaredError);
    const loaded = await loadAttachments(attachments, deps.attachmentStorage(supabase));
    if (!loaded.ok) return httpError(400, loaded.error);
```

Apelul către Resend primește câmpul doar când există fișiere:

```ts
    const sent = await deps.resend.send({
      from: `${identity.display_name || 'Utilizator'} <${identity.mailcow_email}>`,
      to: [to],
      subject,
      html: body,
      headers: request_id ? { 'X-Request-ID': request_id } : {},
      ...(loaded.files.length
        ? { attachments: loaded.files.map(({ filename, content, contentType }) => ({ filename, content, contentType })) }
        : {}),
    });
```

`store.insertSentEmail({ … })` primește la final:

```ts
        ...(loaded.files.length ? { attachments: loaded.files.map((f) => f.meta) } : {}),
```

`createSendEmailDeps()` primește:

```ts
    attachmentStorage: (sb) => new SupabaseStorageRepo(sb),
```

În `src/manager-544/emails/store.ts`, `SentEmailRow` primește:

```ts
  attachments?: Array<{ path: string; name: string; type: string; size: number }>;
```

În `app/api/emails/send/route.ts`, adaugă:

```ts
// Descărcarea a până la 20 MB din storage şi trimiterea lor spre Resend pot depăşi limita implicită.
export const maxDuration = 60;
```

- [ ] **Pasul 8: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/emails && npx tsc --noEmit
```

Așteptat: PASS peste tot. Dacă `tsc` semnalează alte locuri care construiesc `SendEmailDeps` (rute, teste), adaugă-le `attachmentStorage` — nu face câmpul opțional ca să ocolești eroarea.

- [ ] **Pasul 9: Commit** (orchestratorul)

```bash
git commit --only src/manager-544/emails/outgoing-attachments.ts tests/unit/m544/emails/outgoing-attachments.test.ts \
  src/manager-544/emails/send.ts src/manager-544/emails/store.ts app/api/emails/send/route.ts \
  tests/unit/m544/emails/send.test.ts -m "Trimitere: ataşamentele pleacă prin Resend, verificate pe octeţi"
```

---

### Task 3: Încărcarea fișierului și starea din wizard

**Files:**
- Create: `src/manager-544/ui/requests/attachments/upload.ts`
- Create: `tests/unit/m544/ui/requests/attachments/upload.test.ts`
- Modify: `src/manager-544/ui/requests/wizard/useWizardQuestions.ts`
- Modify: testul existent al hook-ului (`tests/unit/m544/ui/requests/wizard/` — caută fișierul care importă `useWizardQuestions` sau `useRequestWizard`; dacă nu există, creează `useWizardQuestions.test.ts` acolo)

**Interfaces:**
- Consumes: `OutgoingAttachment`, `outgoingPath`, `QuestionItem.attachments` (Task 1).
- Produces:
  - `interface AttachmentUploader { userId(): Promise<string>; upload(path: string, file: File): Promise<void> }`
  - `browserUploader(): AttachmentUploader`
  - `uploadAttachment(file: File, deps?: { uploader?: AttachmentUploader; newId?: () => string }): Promise<OutgoingAttachment>`
  - din `useWizardQuestions` (deci și din `useRequestWizard`, care îl întinde cu `...questions`):
    - `setQuestionAttachments(id: string, attachments: OutgoingAttachment[]): void`
    - `setAttachmentsBusy(id: string, busy: boolean): void`
    - `canProceedToStep3` devine fals cât timp vreo întrebare are atașamente ocupate.

- [ ] **Pasul 1: Scrie testul care pică — upload**

`tests/unit/m544/ui/requests/attachments/upload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { uploadAttachment, type AttachmentUploader } from '@m544/ui/requests/attachments/upload';

function fakeUploader() {
  const uploaded: string[] = [];
  const uploader: AttachmentUploader = {
    userId: async () => 'u1',
    upload: async (path) => {
      uploaded.push(path);
    },
  };
  return { uploader, uploaded };
}

const pdf = (name = 'doc.pdf') => new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });

describe('uploadAttachment', () => {
  it('urcă fişierul sub folderul utilizatorului şi întoarce referinţa', async () => {
    const { uploader, uploaded } = fakeUploader();
    const att = await uploadAttachment(pdf('Răspuns 544.pdf'), { uploader, newId: () => 'id1' });
    expect(uploaded).toEqual(['u1/outgoing/id1/Răspuns 544.pdf']);
    expect(att).toEqual({ path: 'u1/outgoing/id1/Răspuns 544.pdf', name: 'Răspuns 544.pdf', type: 'application/pdf', size: 8 });
  });

  it('dă căi distincte aceluiaşi fişier ataşat de două ori (Review Focus 5)', async () => {
    const { uploader, uploaded } = fakeUploader();
    let n = 0;
    const newId = () => `id${++n}`;
    await uploadAttachment(pdf(), { uploader, newId });
    await uploadAttachment(pdf(), { uploader, newId });
    expect(new Set(uploaded).size).toBe(2);
  });

  it('propagă eroarea de storage, ca interfaţa s-o poată arăta', async () => {
    const uploader: AttachmentUploader = {
      userId: async () => 'u1',
      upload: async () => {
        throw new Error('rețea');
      },
    };
    await expect(uploadAttachment(pdf(), { uploader, newId: () => 'x' })).rejects.toThrow('rețea');
  });
});
```

- [ ] **Pasul 2: Rulează — trebuie să pice**

```bash
npx vitest run tests/unit/m544/ui/requests/attachments/upload.test.ts
```

Așteptat: FAIL — modul inexistent.

- [ ] **Pasul 3: Implementează upload-ul**

`src/manager-544/ui/requests/attachments/upload.ts`:

```ts
/**
 * Încărcarea unui fişier ales la o întrebare, direct în bucket-ul `email-attachments`.
 * RLS-ul bucket-ului permite fiecărui utilizator să scrie doar sub `<uid>/…`; calea o construieşte
 * `outgoingPath`, cu un id nou la fiecare fişier, ca acelaşi fişier ataşat de două ori să nu se
 * suprascrie. Spec: docs/plans/2026-09-23-atasamente-design.md §3, §4.3.
 */
import { createBrowserClient } from '@m544/shared/db/browser-client';
import { ATTACHMENTS_BUCKET } from '@m544/shared/db/storage-repo';
import { safeFilename } from '@m544/inbound/webhook/attachments';
import { outgoingPath, type OutgoingAttachment } from '@m544/requests/attachments';

export interface AttachmentUploader {
  userId(): Promise<string>;
  upload(path: string, file: File): Promise<void>;
}

export function browserUploader(): AttachmentUploader {
  const sb = createBrowserClient();
  return {
    async userId() {
      const { data, error } = await sb.auth.getUser();
      if (error || !data.user) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
      return data.user.id;
    },
    async upload(path, file) {
      const { error } = await sb.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
    },
  };
}

export async function uploadAttachment(
  file: File,
  deps: { uploader?: AttachmentUploader; newId?: () => string } = {},
): Promise<OutgoingAttachment> {
  const uploader = deps.uploader ?? browserUploader();
  const id = (deps.newId ?? (() => crypto.randomUUID()))();
  const path = outgoingPath(await uploader.userId(), id, file.name);
  await uploader.upload(path, file);
  return { path, name: safeFilename(file.name), type: file.type, size: file.size };
}
```

- [ ] **Pasul 4: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/ui/requests/attachments/upload.test.ts
```

- [ ] **Pasul 5: Scrie testele care pică — starea wizard-ului**

În testul hook-ului (cu `renderHook` și `act` din `@testing-library/react`, mediu jsdom — `// @vitest-environment jsdom` pe prima linie dacă fișierul e nou):

```ts
describe('useWizardQuestions — ataşamente', () => {
  const ATT = { path: 'u1/outgoing/id1/doc.pdf', name: 'doc.pdf', type: 'application/pdf', size: 8 };

  it('ataşează fişierele la întrebarea potrivită şi le păstrează în selecţie', () => {
    const { result } = renderHook(() => useWizardQuestions());
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
    const id = result.current.getSelectedQuestions()[0].id;
    act(() => result.current.setQuestionAttachments(id, [ATT]));
    expect(result.current.getSelectedQuestions()[0].attachments).toEqual([ATT]);
  });

  it('blochează previzualizarea cât timp o întrebare are un fişier ocupat (Review Focus 4)', () => {
    const { result } = renderHook(() => useWizardQuestions());
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
    const id = result.current.getSelectedQuestions()[0].id;
    expect(result.current.canProceedToStep3).toBe(true);
    act(() => result.current.setAttachmentsBusy(id, true));
    expect(result.current.canProceedToStep3).toBe(false);
    act(() => result.current.setAttachmentsBusy(id, false));
    expect(result.current.canProceedToStep3).toBe(true);
  });

  it('eliberează blocarea când întrebarea ocupată e ştearsă', () => {
    const { result } = renderHook(() => useWizardQuestions());
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
    const id = result.current.getSelectedQuestions()[0].id;
    act(() => result.current.setAttachmentsBusy(id, true));
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'Altă întrebare'));
    act(() => result.current.removeQuestion(id));
    expect(result.current.canProceedToStep3).toBe(true);
  });
});
```

- [ ] **Pasul 6: Rulează — trebuie să pice**

- [ ] **Pasul 7: Implementează în `useWizardQuestions.ts`**

Importul:

```ts
import type { OutgoingAttachment } from '@m544/requests/attachments';
```

Stare nouă, lângă `selectedQuestionIds`:

```ts
  // Întrebările cu un fişier în curs de încărcare sau eşuat; cât timp există, nu se trece la
  // previzualizare — altfel ar pleca o cerere fără fişierul pe care omul crede că l-a ataşat.
  const [busyAttachmentIds, setBusyAttachmentIds] = useState<ReadonlySet<string>>(() => new Set());
```

Mutațiile noi:

```ts
  const setQuestionAttachments = useCallback((id: string, attachments: OutgoingAttachment[]) => {
    setQuestions((prev) => mapAll(prev, (items) => items.map((q) => (q.id === id ? { ...q, attachments } : q))));
  }, []);

  const setAttachmentsBusy = useCallback((id: string, busy: boolean) => {
    setBusyAttachmentIds((prev) => withIds(prev, [id], busy));
  }, []);
```

`removeQuestion` eliberează și blocarea:

```ts
  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => mapAll(prev, (items) => items.filter((q) => q.id !== id)));
    setSelectedQuestionIds((prev) => withIds(prev, [id], false));
    setBusyAttachmentIds((prev) => withIds(prev, [id], false));
  }, []);
```

`canProceedToStep3`:

```ts
  const canProceedToStep3 = useMemo(
    () => selectedCount > 0 && busyAttachmentIds.size === 0,
    [selectedCount, busyAttachmentIds],
  );
```

Și în obiectul returnat adaugă `setQuestionAttachments` și `setAttachmentsBusy`.

**Notă:** `withIds` e helper-ul existent din fișier pentru `selectedQuestionIds`. Dacă semnătura lui
diferă (de exemplu cere `Set<string>` mutabil), adaptează tipul lui `busyAttachmentIds` la el, nu
invers.

- [ ] **Pasul 8: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/ui/requests && npx tsc --noEmit
```

- [ ] **Pasul 9: Commit** (orchestratorul)

---

### Task 4: Componenta `AttachmentPicker`

**Files:**
- Create: `src/manager-544/ui/requests/attachments/AttachmentPicker.tsx`
- Create: `tests/unit/m544/ui/requests/attachments/AttachmentPicker.test.tsx`

**Interfaces:**
- Consumes: `checkNewAttachment`, `formatMb`, `ATTACHMENT_ACCEPT`, `OutgoingAttachment` (Task 1); `uploadAttachment` (Task 3).
- Produces:

```ts
interface AttachmentPickerProps {
  attachments: OutgoingAttachment[];
  onChange: (next: OutgoingAttachment[]) => void;
  /** true cât timp un fişier se încarcă sau a eşuat şi n-a fost scos. */
  onBusyChange?: (busy: boolean) => void;
  upload?: (file: File) => Promise<OutgoingAttachment>;
}
export function AttachmentPicker(props: AttachmentPickerProps): JSX.Element
```

- [ ] **Pasul 1: Scrie testul care pică**

`tests/unit/m544/ui/requests/attachments/AttachmentPicker.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { AttachmentPicker } from '@m544/ui/requests/attachments/AttachmentPicker';
import type { OutgoingAttachment } from '@m544/requests/attachments';

afterEach(cleanup);

const pdf = (name = 'doc.pdf') => new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });
const toAtt = (f: File): OutgoingAttachment => ({ path: `u1/outgoing/x/${f.name}`, name: f.name, type: f.type, size: f.size });

/** Ţine starea ca părintele real, ca `onChange` să se vadă în randare. */
function Harness(props: { upload: (f: File) => Promise<OutgoingAttachment>; onBusy?: (b: boolean) => void; initial?: OutgoingAttachment[] }) {
  const [atts, setAtts] = useState<OutgoingAttachment[]>(props.initial ?? []);
  return <AttachmentPicker attachments={atts} onChange={setAtts} onBusyChange={props.onBusy} upload={props.upload} />;
}

const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('AttachmentPicker', () => {
  it('urcă fişierul ales şi îl afişează cu mărimea', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    render(<Harness upload={upload} />);
    fireEvent.change(input(), { target: { files: [pdf('groapa.pdf')] } });
    await waitFor(() => expect(screen.getByText('groapa.pdf')).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('refuză un tip neacceptat fără să-l urce, şi blochează până e scos', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    const onBusy = vi.fn();
    render(<Harness upload={upload} onBusy={onBusy} />);
    fireEvent.change(input(), { target: { files: [new File(['x'], 'a.docx', { type: 'application/msword' })] } });
    await waitFor(() => expect(screen.getByText(/nu e acceptat/)).toBeTruthy());
    expect(upload).not.toHaveBeenCalled();
    expect(onBusy).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /Elimină a\.docx/ }));
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false));
  });

  it('scoate un fişier deja urcat', async () => {
    render(<Harness upload={async (f) => toAtt(f)} initial={[toAtt(pdf('vechi.pdf'))]} />);
    fireEvent.click(screen.getByRole('button', { name: /Elimină vechi\.pdf/ }));
    await waitFor(() => expect(screen.queryByText('vechi.pdf')).toBeNull());
  });

  it('arată eroarea de încărcare şi permite reîncercarea', async () => {
    let fail = true;
    const upload = vi.fn(async (f: File) => {
      if (fail) {
        fail = false;
        throw new Error('rețea');
      }
      return toAtt(f);
    });
    render(<Harness upload={upload} />);
    fireEvent.change(input(), { target: { files: [pdf('doc.pdf')] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Reîncearcă/ })).toBeNull());
    expect(screen.getByText('doc.pdf')).toBeTruthy();
  });
});
```

- [ ] **Pasul 2: Rulează — trebuie să pice**

- [ ] **Pasul 3: Implementează**

`src/manager-544/ui/requests/attachments/AttachmentPicker.tsx`:

```tsx
'use client';

/**
 * „📎 Ataşează" pentru o întrebare: alege fişiere, le verifică pe loc, le urcă unul câte unul şi
 * le afişează cu mărime şi „✕". Un fişier refuzat sau eşuat rămâne vizibil, cu motivul, şi ţine
 * întrebarea „ocupată" până e scos sau reîncercat — ca omul să nu ajungă la previzualizare
 * crezând că a ataşat ceva ce nu s-a urcat. Spec: docs/plans/2026-09-23-atasamente-design.md §4.3.
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, Loader2, AlertCircle } from 'lucide-react';
import { ATTACHMENT_ACCEPT, checkNewAttachment, formatMb, type OutgoingAttachment } from '@m544/requests/attachments';
import { uploadAttachment } from './upload';

interface Pending {
  key: string;
  name: string;
  status: 'uploading' | 'error';
  error?: string;
  /** Prezent doar la eşecurile de încărcare — refuzurile de validare nu se pot reîncerca. */
  file?: File;
}

interface AttachmentPickerProps {
  attachments: OutgoingAttachment[];
  onChange: (next: OutgoingAttachment[]) => void;
  onBusyChange?: (busy: boolean) => void;
  upload?: (file: File) => Promise<OutgoingAttachment>;
}

let pendingSeq = 0;

export function AttachmentPicker({ attachments, onChange, onBusyChange, upload = (f) => uploadAttachment(f) }: AttachmentPickerProps) {
  const [pending, setPending] = useState<Pending[]>([]);
  // Ultima listă cunoscută: încărcările durează, iar între timp părintele poate re-randa.
  const latest = useRef(attachments);
  latest.current = attachments;

  const busy = pending.length > 0;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const runUpload = async (key: string, file: File) => {
    setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'uploading', error: undefined } : x)));
    try {
      const att = await upload(file);
      latest.current = [...latest.current, att];
      onChange(latest.current);
      setPending((p) => p.filter((x) => x.key !== key));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Încărcarea a eșuat.';
      setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'error', error, file } : x)));
    }
  };

  const onFiles = async (files: FileList | File[] | null) => {
    for (const file of Array.from(files ?? [])) {
      const key = `p${++pendingSeq}`;
      const inFlight = pending.filter((x) => x.status === 'uploading' && x.file).map((x) => ({ size: x.file!.size }));
      const reason = checkNewAttachment([...latest.current, ...inFlight], file);
      if (reason) {
        setPending((p) => [...p, { key, name: file.name, status: 'error', error: reason }]);
        continue;
      }
      setPending((p) => [...p, { key, name: file.name, status: 'uploading', file }]);
      await runUpload(key, file);
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map((a) => (
        <div key={a.path} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <Paperclip className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{a.name}</span>
          <span className="text-gray-400">{formatMb(a.size)}</span>
          <button
            type="button"
            aria-label={`Elimină ${a.name}`}
            onClick={() => onChange(latest.current.filter((x) => x.path !== a.path))}
            className="p-0.5 text-gray-400 hover:text-protest-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {pending.map((p) => (
        <div key={p.key} className="flex items-start gap-2 text-xs">
          {p.status === 'uploading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-civic-blue-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-protest-red-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <span className="truncate text-gray-700 dark:text-gray-300">{p.name}</span>{' '}
            {p.status === 'uploading' ? (
              <span className="text-gray-400">se încarcă…</span>
            ) : (
              <span className="text-protest-red-700 dark:text-protest-red-300">{p.error}</span>
            )}
          </div>
          {p.status === 'error' && p.file && (
            <button type="button" onClick={() => runUpload(p.key, p.file!)} className="text-civic-blue-600 dark:text-civic-blue-400 hover:underline shrink-0">
              Reîncearcă
            </button>
          )}
          {p.status === 'error' && (
            <button
              type="button"
              aria-label={`Elimină ${p.name}`}
              onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}
              className="p-0.5 text-gray-400 hover:text-protest-red-600 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-blue-600 dark:text-civic-blue-400 cursor-pointer hover:underline">
        <Paperclip className="h-3.5 w-3.5" />
        Atașează
        <input
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
```

- [ ] **Pasul 4: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/ui/requests/attachments && npx tsc --noEmit
```

- [ ] **Pasul 5: Commit** (orchestratorul)

---

### Task 5: Legarea în wizard și în previzualizare

**Files:**
- Modify: `src/manager-544/ui/requests/questions/FreeQuestionEditor.tsx` (drumul manual)
- Modify: `src/manager-544/ui/requests/questions/QuestionItem.tsx` (drumul din chat)
- Modify: `src/manager-544/ui/requests/questions/QuestionCategoryList.tsx` / `QuestionCategory.tsx` (doar cât să ajungă callback-urile la `QuestionItem`)
- Modify: `src/manager-544/ui/requests/wizard/StepSelectQuestions.tsx`
- Modify: `src/manager-544/ui/requests/preview/PreviewEmailCard.tsx`, `PreviewModal.tsx`
- Modify: testele existente ale acestor componente

**Interfaces:**
- Consumes: `AttachmentPicker` (Task 4); `wizard.setQuestionAttachments`, `wizard.setAttachmentsBusy` (Task 3).
- Produces: `PreviewEmailCard` primește prop-ul opțional `attachments?: OutgoingAttachment[]`.

- [ ] **Pasul 1: Scrie testele care pică**

(a) Editorul liber randează un `AttachmentPicker` pe fiecare întrebare și propagă schimbările — în testul existent al `FreeQuestionEditor`:

```tsx
  it('are „Ataşează" pe fiecare întrebare şi raportează fişierele întrebării potrivite', () => {
    const onAttachmentsChange = vi.fn();
    render(
      <FreeQuestionEditor
        questions={[q('1', 'Prima'), q('2', 'A doua')]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onAttachmentsChange={onAttachmentsChange}
        onAttachmentsBusy={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Atașează')).toHaveLength(2);
  });
```

(`q(id, text)` e fixtura din fișier; dacă numele diferă, folosește-l pe cel existent.)

(b) Pe drumul din chat, `QuestionItem` arată „Atașează" **doar când întrebarea e bifată** — atașamentele contează numai pentru ce pleacă:

```tsx
  it('arată „Ataşează" doar la întrebările selectate', () => {
    const { rerender } = render(<QuestionItem question={item} isSelected={false} onToggle={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByText('Atașează')).toBeNull();
    rerender(
      <QuestionItem question={item} isSelected onToggle={vi.fn()} onEdit={vi.fn()} onAttachmentsChange={vi.fn()} onAttachmentsBusy={vi.fn()} />,
    );
    expect(screen.getByText('Atașează')).toBeTruthy();
  });
```

(Folosește numele reale ale prop-urilor din `QuestionItem.tsx` — `isSelected` e o presupunere; citește componenta.)

(c) Previzualizarea listează atașamentele emailului:

```tsx
  it('arată fişierele care pleacă cu emailul', () => {
    render(
      <PreviewEmailCard index={0} total={1} question="Bugetul?" formData={formData}
        attachments={[{ path: 'u1/outgoing/x/groapa.jpg', name: 'groapa.jpg', type: 'image/jpeg', size: 2 * 1024 * 1024 }]} />,
    );
    expect(screen.getByText('groapa.jpg')).toBeTruthy();
    expect(screen.getByText(/2,0 MB/)).toBeTruthy();
  });
```

- [ ] **Pasul 2: Rulează — trebuie să pice**

- [ ] **Pasul 3: Implementează**

- `FreeQuestionEditor`: prop-uri noi `onAttachmentsChange: (id: string, next: OutgoingAttachment[]) => void` și `onAttachmentsBusy: (id: string, busy: boolean) => void`; sub fiecare întrebare:

```tsx
<AttachmentPicker
  attachments={question.attachments ?? []}
  onChange={(next) => onAttachmentsChange(question.id, next)}
  onBusyChange={(busy) => onAttachmentsBusy(question.id, busy)}
/>
```

  **Atenție:** `onBusyChange` e dependență de `useEffect` în `AttachmentPicker`. O funcție nouă la fiecare randare re-declanșează efectul la nesfârșit dacă părintele re-randează la schimbarea stării de busy. Stabilizează-l cu `useCallback` pe `question.id`, sau extrage un mic `QuestionAttachments` care îl memorează.

- `QuestionItem` (drumul din chat): aceleași două prop-uri, opționale; `AttachmentPicker` doar când întrebarea e selectată și prop-urile există. Treci callback-urile prin `QuestionCategoryList` → `QuestionCategory` → `QuestionItem`.
- `StepSelectQuestions`: leagă ambele drumuri la `wizard.setQuestionAttachments` și `wizard.setAttachmentsBusy`. Când `canProceedToStep3` e fals din cauza atașamentelor, sub bară apare textul „Așteaptă încărcarea atașamentelor sau scoate fișierele cu eroare." — adaugă în `useWizardQuestions` un `hasBusyAttachments: boolean` expus, dacă ai nevoie să distingi motivul.
- `PreviewEmailCard`: prop `attachments?: OutgoingAttachment[]`; sub antetele emailului, câte un rând „📎 nume · mărime”. `PreviewModal` îi pasează `q.attachments`.

- [ ] **Pasul 4: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/ui/requests && npx tsc --noEmit
```

- [ ] **Pasul 5: Commit** (orchestratorul)

---

### Task 6: Coada de trimitere poartă atașamentele și arată eșecurile

**Files:**
- Modify: `src/manager-544/ui/requests/preview/send-requests.ts` (`buildEmailRequest`)
- Modify: `src/manager-544/ui/requests/preview/send-queue-store.ts` (starea, bucla)
- Modify: `src/manager-544/ui/requests/preview/SendQueueBanner.tsx` (starea `done`)
- Modify: `tests/unit/m544/ui/requests/preview/useSendQueue.test.ts`, `send-queue-store.test.ts`, `SendQueueBanner.test.tsx`

**Interfaces:**
- Consumes: `QuestionItem.attachments` (Task 1).
- Produces:
  - `buildEmailRequest(question: QuestionItem, formData: WizardFormData, requestId: string)` — primește **întrebarea**, nu textul.
  - `SendQueueState.failures: Array<{ question: string; error: string }>` (`[]` în `IDLE`).

- [ ] **Pasul 1: Scrie testele care pică**

(a) `useSendQueue.test.ts`, lângă testele `buildEmailRequest`:

```ts
  it('pune ataşamentele întrebării în corpul trimiterii', () => {
    const ATT = { path: 'u1/outgoing/x/doc.pdf', name: 'doc.pdf', type: 'application/pdf', size: 8 };
    const body = buildEmailRequest({ ...INPUT.selectedQuestions[0], attachments: [ATT] }, INPUT.formData, 'r1');
    expect(body.attachments).toEqual([ATT]);
  });

  it('fără ataşamente, corpul nu are câmpul', () => {
    expect(buildEmailRequest(INPUT.selectedQuestions[0], INPUT.formData, 'r1')).not.toHaveProperty('attachments');
  });
```

Actualizează apelurile existente `buildEmailRequest('text', …)` la `buildEmailRequest(question, …)`.

(b) `send-queue-store.test.ts` — `FORM`, `Q`, `INPUT`, `json`, `fakeFetch` sunt fixturile din capul fișierului:

```ts
  it('trimite restul întrebărilor când una eşuează şi reţine motivul (Review Focus 3)', async () => {
    const three: SendQueueInput = {
      ...INPUT,
      selectedQuestions: [...Q, { id: 'c', category: 'A_FINANCIAR', text: 'Câte contracte?', isCustom: true, isEdited: false }],
    };
    let emailCall = 0;
    const { fetchFn } = fakeFetch({
      '/api/sessions/create': () => json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] }),
      '/api/emails/send': () =>
        ++emailCall === 2
          ? json(400, { error: 'Fișierul „doc.pdf” nu mai e disponibil. Atașează-l din nou.' })
          : json(200, { success: true }),
    });
    await startSend(three, { fetch: fetchFn, sleep: async () => {}, markHandoffSession: async () => {} });
    const s = getSendQueueState();
    expect(s.status).toBe('done');
    expect(s.sent).toBe(2);
    expect(s.failures).toEqual([{ question: 'Cine răspunde?', error: expect.stringContaining('doc.pdf') }]);
  });
```

(c) `SendQueueBanner.test.tsx` — banner-ul citește store-ul real, deci testul rulează o trimitere adevărată cu fetch fals:

```tsx
  it('spune ce n-a plecat şi de ce', async () => {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const form: WizardFormData = {
      solicitantName: 'Ion Popescu', solicitantEmail: 'ion@mail.ro', solicitantAddress: 'Str. Victoriei 10',
      saveAddress: false, institutionName: 'Primăria Pitești', institutionEmail: 'registratura@primaria.ro', sessionName: 'T',
    };
    const questions: QuestionItem[] = ['Unu?', 'Doi?', 'Trei?'].map((text, i) => ({
      id: `q${i}`, category: 'A_FINANCIAR', text, isCustom: true, isEdited: false,
    }));
    let emailCall = 0;
    const fetchFn = vi.fn(async (url: string) =>
      url === '/api/emails/send'
        ? ++emailCall === 2
          ? json(400, { error: 'Fișierul „doc.pdf” nu mai e disponibil. Atașează-l din nou.' })
          : json(200, { success: true })
        : json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] }),
    ) as unknown as typeof fetch;

    render(<SendQueueBanner />);
    await act(async () => {
      await startSend(
        { selectedQuestions: questions, formData: form, conversationId: null },
        { fetch: fetchFn, sleep: async () => {} },
      );
    });
    expect(screen.getByText(/2 din 3/)).toBeTruthy();
    expect(screen.getByText(/nu mai e disponibil/)).toBeTruthy();
  });
```

- [ ] **Pasul 2: Rulează — trebuie să pice**

- [ ] **Pasul 3: Implementează**

`send-requests.ts`:

```ts
/** Step 2 of the send: the body of one /api/emails/send call. */
export function buildEmailRequest(question: QuestionItem, formData: WizardFormData, requestId: string) {
  return {
    to: formData.institutionEmail,
    subject: FIXED_SUBJECT,
    body: formatEmailBodyHtml(question.text, formData),
    request_id: requestId,
    ...(question.attachments?.length ? { attachments: question.attachments } : {}),
  };
}
```

`send-queue-store.ts`:
- `SendQueueState` primește `failures: Array<{ question: string; error: string }>;`, iar `IDLE` primește `failures: []`.
- În buclă, `buildEmailRequest(selectedQuestions[i].text, …)` devine `buildEmailRequest(selectedQuestions[i], …)`, iar ramura de eșec:

```ts
      if (!emailResponse.ok) {
        // Nu doar în consolă: omul trebuie să afle ce cerere n-a plecat şi de ce.
        const error = await readError(emailResponse);
        console.error(`Failed to send email ${i + 1}:`, error);
        failures.push({ question: selectedQuestions[i].text, error });
        setState({ failures: [...failures] });
      } else {
```

  cu `const failures: SendQueueState['failures'] = [];` înainte de buclă și helper-ul:

```ts
async function readError(response: Response): Promise<string> {
  try {
    const data: { error?: string } = await response.json();
    return data.error || `Eroare ${response.status}`;
  } catch {
    return `Eroare ${response.status}`;
  }
}
```

`SendQueueBanner.tsx`, starea `done`: cu `failures.length === 0`, textul de azi. Altfel:
„**{sent} din {total}** cereri au fost trimise către {instituție}. Nu au plecat:” urmat de listă —
fiecare rând cu primele ~60 de caractere ale întrebării și motivul. Iconița devine avertisment, nu bifă.

- [ ] **Pasul 4: Rulează — trebuie să treacă**

```bash
npx vitest run tests/unit/m544/ui/requests/preview && npx tsc --noEmit
```

- [ ] **Pasul 5: Commit** (orchestratorul)

---

### Task 7: Testul browser pe drumul real

**Files:**
- Modify: `tests/browser/03-request-lifecycle.spec.ts`
- Modify: `tests/browser/README.md`

**Interfaces:**
- Consumes: tot ce e mai sus; helper-ii existenți din `tests/browser/helpers/db.ts` și `helpers/institution.ts`.

- [ ] **Pasul 1: Extinde testul**

În testul care trimite cele 2 întrebări prin wizard, înainte de previzualizare, atașează la **prima** întrebare un PDF minim:

```ts
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'dovada.pdf', mimeType: 'application/pdf', buffer: pdf });
    await expect(page.getByText('dovada.pdf')).toBeVisible();
```

În testul „emailurile ajung în registratura instituției", după `waitForRequestsInInbox`:

```ts
    // Exact unul dintre cele două emailuri poartă ataşamentul — cel al primei întrebări.
    const withAttachment = inbox.filter((e) => (e.attachments ?? []).some((a) => a.name.endsWith('.pdf')));
    expect(withAttachment).toHaveLength(1);
```

și, pe partea cetățeanului, că rândul `sent` al primei întrebări are `attachments[0].path` sub `<uid>/outgoing/`.

**Notă:** dacă `EmailRow` din `helpers/db.ts` nu selectează `attachments`, adaugă coloana în select.

- [ ] **Pasul 2: Rulează suita browser** (orchestratorul — un singur cont de test, deci niciodată în paralel)

```bash
npm run test:browser
```

Așteptat: toate testele verzi, inclusiv pașii noi.

- [ ] **Pasul 3: Verificare manuală pe telefon (owner)** — o poză făcută cu iPhone-ul, atașată prin Safari.
  Specificația marchează conversia HEIC → JPEG ca neverificată; ori trece, ori omul primește eroarea
  de tip, nu un fișier stricat.

- [ ] **Pasul 4: Commit** (orchestratorul)

---

## Verificarea finală

- [ ] `npm run check` pe arborele integrat
- [ ] `npm run build` (ruta `/api/emails/send` cu `maxDuration`)
- [ ] `npm run test:browser`
- [ ] `npm run test:e2e` — pipeline-ul de primire nu e atins, dar confirmă
- [ ] verificarea pe telefon din Task 7
