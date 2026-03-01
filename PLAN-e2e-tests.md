# Plan: Teste End-to-End — Pipeline OCR + Clasificare + Matching

## 1. Arhitectura Testelor — 3 Straturi

### Stratul 1: Unit Tests (rapide, fără API externe)
**Cost: 0 API calls | Timp: <5s**

Testează logica pură, fără Mistral/Resend/Supabase:

| Test | Ce verifică | Fișier |
|------|-------------|--------|
| `normalizeSubject()` | Striparea Re:/Fwd:/Răspuns: | request-matching.ts |
| `extractEmailAddr()` | Parsarea RFC 5322 | request-matching.ts |
| `validateRegistrationNumber()` | Detectare nr. real vs "544/2001" | analysis-service.ts |
| `htmlToText()` | Conversie HTML→text | emails/process/route.ts |
| `addDays()` | Calcul deadline 10/30 zile | status-updater.ts |
| Status transitions | pending→received→extension→answered | status-updater.ts |
| Category validation | Doar categorii valide acceptate | analysis-service.ts |
| Answer summary parsing | text/list/table parse corect | analysis-service.ts |

**Acțiune**: Extragem funcțiile pure (momentan private) în module testabile.

---

### Stratul 2: Integration Tests cu Infrastructure Reală (Mistral OCR + AI)
**Cost: ~20 Mistral API calls | Timp: ~2-5 min**

Testează pipeline-ul real pe fiecare PDF din test_data_pdfs:

#### 2a. OCR Integration — Verificare extracție text
Pentru **fiecare** din cele 37 PDF-uri:
1. Citește PDF-ul de pe disc
2. Trimite la `runOcrFromBytes()`
3. Verifică:
   - `markdown` nu e gol
   - `pages >= 1`
   - Conține keywords specifice tipului (ex: "înregistrare", "prelungire", "răspuns")

#### 2b. Classification Integration — Verificare categorizare
Pentru fiecare PDF, după OCR:
1. Trimite textul OCR la `analyzeEmailContent()` cu metadata simulată
2. Verifică categoria returnată vs. categoria așteptată:

| PDF | Categorie așteptată |
|-----|---------------------|
| `*_confirmare*.pdf` | `inregistrate` |
| `*_amanare*.pdf`, `*_prelungire*.pdf` | `amanate` |
| `*_raspuns*.pdf`, `*_raspuns_final*.pdf`, `*_raspuns_favorabil*.pdf` | `raspunse` |
| `*_refuz*.pdf`, `*_refuz_partial*.pdf` | `raspunse` |
| `*_redirectionare*.pdf` | `raspunse` |
| `*_cerere_clarificari*.pdf` | `amanate` (cere info suplimentar) |

3. Verifică `confidence >= 0.7`
4. Verifică `registration_number` este extras (sau null pt cereri inițiale)
5. Verifică `answer_summary` există pentru `raspunse`

#### 2c. Snapshot Tests — Stabilitate clasificare
- Prima rulare: salvează rezultatele ca "golden snapshots" (JSON)
- Rulări ulterioare: compară cu snapshot-ul
- Alertează dacă o clasificare se schimbă (regression detection)

---

### Stratul 3: E2E Full Pipeline — Simulare Back-and-Forth
**Cost: ~10 Resend emails + ~10 Mistral calls | Timp: ~5-10 min**

#### Strategia cu 2 Conturi

```
CONT_A (Cetățean)                    CONT_B (Instituție simulată)
test-cetatean@implicarecivica.ro     test-institutie@implicarecivica.ro
         │                                       │
         │  1. Crează sesiune cu 3 cereri        │
         │  2. Trimite email cu cerere ─────────>│
         │                                       │
         │  3. Webhook simul: confirmare+PDF <───│
         │  4. Process: OCR→Clasif→Match         │
         │  5. ASSERT: status=received           │
         │                                       │
         │  6. Webhook simul: amânare+PDF  <─────│
         │  7. Process: OCR→Clasif→Match         │
         │  8. ASSERT: status=extension          │
         │                                       │
         │  9. Webhook simul: răspuns+PDF  <─────│
         │ 10. Process: OCR→Clasif→Match         │
         │ 11. ASSERT: status=answered           │
         │ 12. ASSERT: session=completed         │
```

#### Cum simulăm "instituția" fără email real

**Abordarea**: **Direct Webhook Injection** (nu trimitem email real de la instituție)

Motivație:
- Nu avem control real pe ce face instituția
- Testul ar fi extrem de fragil cu 2 emailuri reale (timing, deliverability)
- Webhook-ul e interfața de intrare — testăm de acolo în jos

**Implementare**:
1. Creăm un user test + profil în Supabase cu `mailcow_email = test-cetatean@implicarecivica.ro`
2. Creăm o sesiune cu N cereri (batch) via `createSessionWithRequests()`
3. Trimitem emailul inițial real via `POST /api/emails/send` (Resend) — confirmă că trimiterea funcționează
4. Pentru răspunsurile instituției: **injectăm direct** payload-ul de webhook cu PDF-urile din test_data_pdfs

```typescript
// Simulăm ce face Resend webhook-ul:
const webhookPayload = {
  type: 'email.received',
  data: {
    from: 'Primaria Sector 3 <registratura@ps3.ro>',
    to: ['test-cetatean@implicarecivica.ro'],
    subject: 'Re: Cerere informații publice - Parcuri',
    html: '<p>Stimate solicitant, vă comunicăm...</p>',
    email_id: `test-${crypto.randomUUID()}`,
    message_id: `<test-${Date.now()}@ps3.ro>`,
    headers: {
      'In-Reply-To': '<original-message-id>',  // thread linking
    },
    attachments: [{ filename: '1_confirmare.pdf', content_type: 'application/pdf' }],
    created_at: new Date().toISOString(),
  },
};
```

5. Dar PDF-urile trebuie să fie accesibile. **Soluție**: le uploadăm direct în Supabase Storage înainte, apoi webhook-ul nostru customizat le linkează.

#### Varianta mai simplă și mai robustă:

**Skip webhook entirely, test pipeline direct:**
1. Inserăm emailul direct în DB (ca și cum webhook-ul l-a procesat)
2. Uploadăm PDF-ul în Supabase Storage la path-ul corect
3. Apelăm `POST /api/emails/process { email_id }`
4. Verificăm rezultatul

Aceasta testează: OCR → Clasificare → Matching → Status Update — exact ce contează.

---

## 2. Scenariile de Test Mapate pe PDF Sets

### Scenariul 1: Happy Path (Set_1_Happy_Path_Parcuri)
```
Sesiune: "Informații parcuri" → Primăria Sectorului X
  └─ Request 1: cerere despre parcuri
      Step 1: Trimite email (Resend)          → status: pending
      Step 2: Inject 1_confirmare.pdf         → status: received, reg_nr extras
      Step 3: Inject 2_raspuns_final.pdf      → status: answered, answer_summary prezent
  ASSERT: session.cached_status = 'completed'
```

### Scenariul 2: Cu Amânare (Set_2_Delayed_Achizitii)
```
Sesiune: "Achiziții publice" → Primăria X
  └─ Request 1: cerere despre achiziții
      Step 1: Inject 1_confirmare.pdf         → status: received
      Step 2: Inject 2_notificare_prelungire  → status: extension, extension_date = +30 zile
      Step 3: Inject 3_raspuns_final.pdf      → status: answered
  ASSERT: extension_date era setat corect
  ASSERT: session.cached_status = 'completed'
```

### Scenariul 3: Refuz (Set_3_Refusal_Salarii)
```
Sesiune: "Salarii funcționari" → Primăria X
  └─ Request 1: cerere salarii
      Step 1: Inject 1_confirmare.pdf         → status: received
      Step 2: Inject 2_refuz.pdf              → status: answered (refuzul e tot un răspuns)
  ASSERT: answer_summary conține motivul refuzului
```

### Scenariul 4: Redirecționare (Set_4_Redirection_Metro)
```
Sesiune: "Informații metrou" → Primăria X
  └─ Request 1: cerere metrou
      Step 1: Inject 1_confirmare.pdf         → status: received
      Step 2: Inject 2_redirectionare.pdf     → status: answered (redirecționare = răspuns)
  ASSERT: answer_summary menționează instituția corectă
```

### Scenariul 5: Clarificări (Set_5_Clarification_Scoli)
```
Sesiune: "Informații școli" → Inspectoratul X
  └─ Request 1: cerere școli
      Step 1: Inject 1_confirmare.pdf           → status: received
      Step 2: Inject 2_cerere_clarificari.pdf   → status: extension/amanate
      Step 3: Inject 3_raspuns_final.pdf         → status: answered
```

### Scenariul 6: Batch/Sesiune cu Multiple Requests (COMPOZIT)
```
Sesiune: "Contracte și cheltuieli" → Primăria X
  ├─ Request 1 (Set_1_Contracte): cerere_initiala → confirmare → amanare → raspuns
  ├─ Request 2 (Set_3_Cheltuieli): cerere_initiala → confirmare → amanare → raspuns
  └─ Request 3 (Set_5_Angajari): cerere_initiala → confirmare → amanare → raspuns

  ASSERT la fiecare pas:
    - Fiecare email se match-uiește la request-ul CORECT (nu la altul)
    - session.cached_status evoluează: pending → in_progress → partial_answered → completed
    - total_requests = 3, fiecare cu status-ul lui independent
```

### Scenariul 7: Matching 3-Tier (dedicat)
```
Test A: Thread matching — inject email cu parent_email_id valid
Test B: Registration number — inject email cu nr. înregistrare existent
Test C: Context matching — inject email de la institution_email al request-ului
Test D: No match — inject email de la adresă necunoscută → match = null
```

### Scenariul 8: Edge Cases
```
Test A: PDF corupt / gol → OCR eșuează graceful, analiza continuă pe subject+body
Test B: Email fără PDF → clasificare doar din subject + body text
Test C: Email duplicat → 23505 constraint, nu se duplică
Test D: Registration number = "544/2001" → filtrat, nu se setează
Test E: Email pe cont answered → nu se downgrade-ează
Test F: retry_count >= 3 → status = failed, nu se mai procesează
```

---

## 3. Framework & Structura Fișierelor

### Framework: Vitest
- Nativ în ecosistemul Next.js/Vite
- Suportă TypeScript out-of-the-box
- `describe/it/expect` familiar
- `beforeAll/afterAll` pentru setup/teardown
- `--bail` pentru stop la primul fail
- `vi.mock()` pentru unit tests

### Structura propusă:
```
tests/
├── setup/
│   ├── test-env.ts              # Env vars, Supabase client, helpers
│   ├── test-fixtures.ts         # Încarcă PDF-urile din test_data_pdfs
│   ├── test-users.ts            # Crează/șterge user test + profil
│   └── pdf-loader.ts            # Utility: citește PDF de pe disc
│
├── unit/
│   ├── normalize-subject.test.ts
│   ├── extract-email.test.ts
│   ├── validate-registration.test.ts
│   ├── html-to-text.test.ts
│   ├── add-days.test.ts
│   └── status-transitions.test.ts
│
├── integration/
│   ├── ocr.test.ts              # Toate PDF-urile prin Mistral OCR
│   ├── classification.test.ts   # Toate PDF-urile prin Mistral Large
│   └── matching.test.ts         # 3-tier matching cu DB real
│
├── e2e/
│   ├── happy-path.test.ts       # Set_1_Happy_Path_Parcuri
│   ├── delayed-response.test.ts # Set_2_Delayed_Achizitii
│   ├── refusal.test.ts          # Set_3_Refusal_Salarii
│   ├── redirection.test.ts      # Set_4_Redirection_Metro
│   ├── clarification.test.ts    # Set_5_Clarification_Scoli
│   ├── batch-session.test.ts    # Sesiune cu 3 requests paralele
│   └── edge-cases.test.ts       # PDF corupt, duplicat, retry, etc.
│
├── snapshots/
│   └── classification-golden.json  # Golden results pt regression
│
└── helpers/
    ├── inject-email.ts          # Inserează email + PDF în DB/Storage
    ├── trigger-process.ts       # Apelează /api/emails/process
    ├── wait-for-status.ts       # Polling cu timeout pe request status
    └── cleanup.ts               # Șterge toate datele de test
```

---

## 4. Helper-ul Central: `inject-email.ts`

Conceptual, asta e piesa cheie:

```typescript
async function injectInstitutionResponse(opts: {
  userId: string;
  requestId: string;
  parentEmailId?: string;
  fromEmail: string;
  subject: string;
  body: string;
  pdfPath: string;           // cale locală la test PDF
  registrationNumber?: string;
}) {
  // 1. Upload PDF în Supabase Storage
  const pdfBytes = fs.readFileSync(opts.pdfPath);
  const emailId = crypto.randomUUID();
  const storagePath = `${opts.userId}/${emailId}/document.pdf`;
  await supabase.storage.from('email-attachments').upload(storagePath, pdfBytes);

  // 2. Insert email record (simulează ce face webhook-ul)
  await supabase.from('emails').insert({
    id: emailId,
    user_id: opts.userId,
    parent_email_id: opts.parentEmailId || null,
    message_id: `<test-${Date.now()}@test.ro>`,
    type: 'received',
    from_email: opts.fromEmail,
    to_email: 'test-cetatean@implicarecivica.ro',
    subject: opts.subject,
    body: opts.body,
    pdf_file_path: storagePath,
    processing_status: 'pending',
    is_read: false,
    received_at: new Date().toISOString(),
    attachments: [{ name: 'document.pdf', type: 'application/pdf', path: storagePath }],
  });

  // 3. Trigger processing pipeline
  const result = await fetch('/api/emails/process', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_id: emailId }),
  });

  return { emailId, result: await result.json() };
}
```

---

## 5. Optimizare Costuri

### Strategie: OCR Once, Cache Results

1. **Prima rulare**: Rulează OCR pe toate 37 PDF-uri, salvează rezultatele în `tests/snapshots/ocr-cache.json`
2. **Rulări ulterioare**: Folosește cache-ul pentru classification tests (skip OCR)
3. **Flag `--fresh-ocr`**: Forțează re-OCR (pentru regression testing)

### Estimare costuri per rulare completă:
| Layer | Mistral calls | Resend emails | Timp estimat |
|-------|--------------|---------------|--------------|
| Unit | 0 | 0 | ~2s |
| Integration OCR (prima dată) | 37 OCR | 0 | ~3 min |
| Integration OCR (cached) | 0 | 0 | ~1s |
| Integration Classification | 37 analysis | 0 | ~2 min |
| E2E (6 scenarii) | ~15 OCR + 15 analysis | 6 sent | ~5 min |
| **TOTAL (prima)** | **~104** | **6** | **~10 min** |
| **TOTAL (cached)** | **~67** | **6** | **~7 min** |

### NPM Scripts:
```json
{
  "test": "vitest run",
  "test:unit": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration",
  "test:e2e": "vitest run tests/e2e",
  "test:ocr-only": "vitest run tests/integration/ocr.test.ts",
  "test:classify-only": "vitest run tests/integration/classification.test.ts",
  "test:fresh": "FRESH_OCR=1 vitest run"
}
```

---

## 6. Setup & Teardown

### `beforeAll` (o singură dată pe suită):
1. Verifică env vars (MISTRAL_API_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY)
2. Creează user test în Supabase Auth (sau folosește unul existent cu id fix)
3. Creează profil cu `mailcow_email = test-cetatean@implicarecivica.ro`
4. Încarcă toate PDF-urile din `test_data_pdfs/` în memorie

### `afterAll`:
1. Șterge toate emailurile cu `user_id = test_user_id`
2. Șterge toate requesturile cu `user_id = test_user_id`
3. Șterge toate sesiunile cu `user_id = test_user_id`
4. Șterge fișierele din Storage sub `test_user_id/`
5. NU șterge userul (reutilizabil)

### Izolare între teste:
- Fiecare test E2E creează propria sesiune cu UUID unic
- Cleanup per-test în `afterEach` (nu doar `afterAll`)
- Timeout generos: 60s per test E2E, 30s per integration

---

## 7. Assertions Cheie

### Per Email Procesat:
```typescript
expect(result.success).toBe(true);
expect(result.category).toBe(expectedCategory);      // 'inregistrate' | 'amanate' | 'raspunse'
expect(result.matchedRequestId).toBe(request.id);     // S-a match-uit corect
expect(result.matchStrategy).toBe(expectedStrategy);   // 'thread' | 'registration' | 'context'
```

### Per Request (după procesare):
```typescript
const req = await getRequest(requestId);
expect(req.status).toBe(expectedStatus);               // 'received' | 'extension' | 'answered'
expect(req.registration_number).toBeTruthy();           // extras din confirmare
expect(req.deadline_date).toBeTruthy();                 // setat la received
if (status === 'extension') {
  expect(req.extension_date).toBeTruthy();              // +30 zile
}
if (status === 'answered') {
  expect(req.answer_summary).toBeTruthy();              // conține datele
  expect(req.answer_summary.type).toBeOneOf(['text', 'list', 'table']);
}
```

### Per Sesiune (batch):
```typescript
const session = await getSession(sessionId);
expect(session.cached_status).toBe(expectedSessionStatus);
// 'pending' → 'in_progress' → 'partial_answered' → 'completed'
```

---

## 8. Pași de Implementare (în ordine)

1. **Instalare Vitest** + configurare `vitest.config.ts` cu path aliases
2. **Exportare funcții pure** din servicii (normalizeSubject, extractEmail, etc.)
3. **Unit tests** (zero cost, validează logica)
4. **`pdf-loader.ts`** — utility care citește PDF-urile din calea externă
5. **`inject-email.ts`** — helper-ul central
6. **Integration OCR test** — validează că Mistral OCR procesează toate PDF-urile
7. **Integration Classification test** — validează categoriile pe toate PDF-urile
8. **Snapshot generation** — salvare golden results
9. **E2E Happy Path** — primul scenariu complet
10. **E2E restul scenariilor** (delayed, refusal, redirection, clarification)
11. **E2E Batch Session** — test cu 3 requests simultane
12. **Edge cases** — PDF corupt, duplicat, retry exhaustion
13. **NPM scripts** + documentare

---

## 9. Decizii de Design

### De ce NU trimitem emailuri reale de la "instituție"?
- Resend nu permite receive pe aceeași adresă de pe care trimiți în mod simplu
- Ar trebui un al doilea domeniu sau mailbox
- Testele ar fi extrem de fragile (timing, deliverability, webhook delay)
- **Webhook injection** testează exact aceeași logică, dar deterministic

### De ce NU mockuim Mistral?
- Scopul explicit al testelor e să verifice că OCR-ul și clasificarea funcționează
- Mock-uri ar testa doar "codul nostru", nu pipeline-ul real
- Snapshot testing detectează regression-uri în modelele Mistral

### De ce Vitest și nu Jest?
- Next.js 15 + Turbopack = ecosistem Vite
- Path aliases (`@/lib/...`) funcționează nativ cu vitest
- Mai rapid, ESM-native, TypeScript fără transpilare separată
