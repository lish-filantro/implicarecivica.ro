# Remedierea raportului de testare — specificație

**Sursa:** raportul de testare „Rezultate testare - implicare civică" (mobil + desktop), primit 2026-09-22.
**Stare:** toate cele 11 observații au fost verificate în cod. Niciuna nu e o neînțelegere a testerului.

Documentul ăsta explică **de ce** fiecare fix e cel care e. Planul de execuție
([2026-09-22-feedback-testare-plan.md](2026-09-22-feedback-testare-plan.md)) argumentează din el; cele două
se citesc împreună.

---

## 1. Ce intră în acest val și ce nu

**Intră** — 10 remedieri cu cauză identificată în cod, plus câmpul de gen și rescrierea textului cererii.

**Nu intră, plan separat:**

- **Bifurcația la începutul unei sesiuni de cereri** (obiecția despre „Selectează întrebările").
  Decizia owner-ului: la sesiune nouă, utilizatorul alege între *„știu deja instituția și întrebările"*
  (wizard manual, cu adresa instituției introdusă de mână) și *„am nevoie de ajutor"* (chatul de
  explorare). Asta nu e o remediere, e o refacere a intrării în flux — cere brainstorming separat,
  fiindcă atinge wizardul, hand-off-ul din chat și regula de verificare online a adresei.
- **Atașamente** (imagini, PDF-uri la cerere). Cere bucket, limite, `attachments` în Resend și afișare
  în firul cererii.

Motivul separării: cele 12 task-uri de mai jos au criterii de acceptanță mecanice și pot fi verificate
fără decizii de produs. Amestecate cu o funcționalitate nouă, s-ar bloca toate în aceeași discuție.

---

## 2. Findings, cauză, fix

### F1 — Denumiri de instituții greșite sau lipsă la căutare

**Simptom:** „Comisariatul Judeţuluial Gărzii Naţionale de Mediu"; un rezultat fără niciun nume.

**Cauză:** [`lib/institutii/load.ts:41`](../../lib/institutii/load.ts) — `.replace(/\s*\{.*?\}\s*/g, '')`
consumă spațiile de **ambele** părți ale placeholderului.

Simulat peste toate cele 86 de fișiere din `data/institutii/`, produce:

| Sursă | Rezultat actual |
|---|---|
| `Comisariatul Județului {JUDET} al Gărzii Naționale de Mediu` | `Comisariatul Județuluial Gărzii...` |
| `Centrul Județean {JUDET} al APIA` | `Centrul Județeanal APIA` |
| `...Finanțelor Publice {REGIUNE} - Administrația...` | `...Finanțelor Publice- Administrația...` |
| `DGITL {LOCALITATE} sau Serviciul Fiscal Local` (nume scurt) | `DGITLsau Serviciul Fiscal Local` |
| `{TIP_SCOALA} {NUME_SCOALA}` (`scoala_publica_template.json`) | **string vid** — rândul gol din raport |

**Fix:** placeholderul se înlocuiește cu un **spațiu**, apoi spațiile se colapsează:
`.replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim()`. Separat, un nume rămas gol cade pe
`tip_institutie`, ca niciun rezultat să nu apară fără etichetă.

**De ce nu se repară în date:** placeholderele sunt intenționate — template-urile se instanțiază per
județ/localitate. Bugul e în randare, nu în sursă.

**Rămâne în afara scopului:** denumirile trunchiate semantic („Consiliul Local al", „Primăria",
„Serviciul de Stare Civilă al") — prepoziția finală orfană. E o îmbunătățire de conținut, nu un bug de
cod; se tratează separat, cu o listă de nume de afișare per template.

### F2 — Subiect afișat ca `=?UTF-8?Q?Re:_Cerere_informa=C8=9Bii...?=`

**Cauză:** subiectul nu e decodat nicăieri în tot repo-ul. Worker-ul ia headerul `Subject` brut
([`cloudflare-email-worker/lib.js:37`](../../cloudflare-email-worker/lib.js)), iar la ingest se folosește
ca atare ([`payload.ts:59`](../../src/manager-544/inbound/webhook/payload.ts),
[`ingest.ts:102`](../../src/manager-544/inbound/ingest.ts)).

**Fix:** un decodor RFC 2047 („encoded-words") pur, aplicat în `parseWorkerPayload`.

**De ce acolo și nu în `mime.ts`:** `postal-mime` expune un subiect deja decodat, dar parsarea MIME se
întâmplă **după** ce subiectul e folosit pentru detectarea campaniilor
([`ingest.ts:52`](../../src/manager-544/inbound/ingest.ts), `cleanReplySubject(env.subject)`), și nu se
întâmplă deloc pe calea de reconciliere din R2
([`reconcile.ts:58`](../../src/manager-544/inbound/reconcile/reconcile.ts)). Decodarea în `payload.ts`
acoperă uniform toate cele trei căi cu o singură funcție pură, testabilă fără fixtură MIME.

**Consecință secundară reparată:** detectarea confirmărilor de campanie compară subiectul cu șablonul;
cu subiect encodat, comparația eșua silențios pentru orice expeditor care encodează headerul.

### F3 — Termene greșite („14z rămase" în loc de 10 zile)

**Stare: deja reparat** pe branch-ul `fix/termene-calendaristice-544` (necomis). Termenele erau în zile
lucrătoare; sunt acum zile calendaristice „pe zile libere" conform art. 16 din Norme
([`legal-days.ts`](../../src/manager-544/shared/utils/legal-days.ts), oracol în
[`tests/fixtures/legal-deadline-oracle.ts`](../../tests/fixtures/legal-deadline-oracle.ts), 86 de teste verzi).

**Ce lipsește:** cererile deja în DB păstrează `deadline_date` calculat cu regula veche. Nimic din
aplicație nu rescrie un rând existent — `pipeline/status` scrie `deadline_date` doar când e gol, și doar
la tranziția către `inregistrate`. Fără backfill, fix-ul nu se vede pe datele existente, inclusiv pe
cererea din raport.

**Fix — deja scris, necomis:** [`tools/backfill-legal-deadlines.ts`](../../tools/backfill-legal-deadlines.ts)
plus testul lui ([`tests/unit/tools/backfill-legal-deadlines.test.ts`](../../tests/unit/tools/backfill-legal-deadlines.test.ts),
8 teste verzi) există în arborele de lucru, netrackuite. Au dry-run implicit și `--apply` explicit.

**De ce script TypeScript și nu migrare SQL:** rostogolirea ultimei zile depinde de sărbătorile legale,
deci de data Paștelui ortodox ([`holidays.ts`](../../src/manager-544/shared/utils/holidays.ts), algoritm
Meeus). Reimplementat în PL/pgSQL, ar fi a doua sursă de adevăr, care divergeaază tăcut. Scriptul
folosește exact `addLegalDays`, funcția pe care o verifică oracolul.

**Rămâne de făcut:** comiterea celor două fișiere, rularea dry-run, citirea planului, apoi `--apply`.
Scriptul nu schimbă niciodată `status` — o cerere marcată `delayed` prea devreme de aritmetica veche
rămâne așa; corectarea statusurilor e o decizie separată.

### F4 — Răspunsul primit nu schimbă statusul cererii („în curs")

Testerul a ghicit corect ambele cauze: răspuns de pe **altă adresă** decât cea a instituției și/sau
**număr de înregistrare greșit**.

**Cauză:** ordinea de potrivire e thread → număr → context
([`match.ts`](../../src/manager-544/pipeline/matching/match.ts)). Contextul acceptă doar două dovezi:
expeditorul == `institution_email`, sau noi am trimis la acea adresă
([`context.ts`](../../src/manager-544/pipeline/matching/context.ts)). Un răspuns de pe adresa personală a
unui funcționar, cu număr greșit, nu produce **niciun** candidat → `NO_MATCH` cu `needsReview: false`,
iar [`process-email.ts:107`](../../src/manager-544/pipeline/process-email.ts) ridică flagul **doar** pe
ambiguitate. Emailul ajunge în inbox nelegat de nimic și fără niciun semnal.

**Fix — mic, fiindcă unealta există deja:** [`ReviewPanel.tsx`](../../src/manager-544/ui/emails/review/ReviewPanel.tsx)
randează deja un banner + un select cu cererile deschise și cheamă `assign`, iar
[`review/service.ts:51`](../../src/manager-544/emails/review/service.ts) reaplică tranziția de status la
asociere. Panoul e însă randat **numai** când `needs_review` e adevărat
([`EmailDetail.tsx:35`](../../src/manager-544/ui/emails/EmailDetail.tsx)).

Deci: când nu există niciun candidat, **dar** analiza clasifică emailul ca răspuns 544, se ridică
`needs_review = true`. Panoul existent apare, utilizatorul alege cererea, statusul se recalculează.

**De ce nu relaxăm regula de potrivire:** a accepta orice expeditor necunoscut ca răspuns la „singura
cerere deschisă" reintroduce exact potrivirile arbitrare pentru care subiectul a fost deja eliminat ca
dovadă. Preferăm o cerere explicită de confirmare în locul unei ghiciri.

### F5 — Butonul de notificări nu face nimic

**Cauză:** [`DashboardHeader.tsx:27`](../../src/manager-544/ui/dashboard/DashboardHeader.tsx) — butonul nu
are `onClick` și nu există rută `/notificari`.

**Fix:** contorul vine din `getUnreadCount()`, adică **emailuri necitite**
([`emails/queries.client.ts:49`](../../src/manager-544/emails/queries.client.ts)). Butonul devine un
`Link` către `/emails`. Fără pagină nouă: eticheta corespunde deja conținutului.

### F6 — Meniul public pe mobil

**Cauză:** [`PublicNavbar.tsx`](../../components/shared/PublicNavbar.tsx) randează necondiționat 5 linkuri
+ CTA + toggle, fără breakpoint și fără hamburger. Zona logată are hamburger — de aici asimetria reclamată.

**Fix:** linkurile se ascund sub `md`, apare un buton hamburger cu panou care le conține pe toate plus CTA.

### F7 — Conținutul cererii

Patru obiecții, toate în [`email-template.ts:23-31`](../../src/manager-544/requests/email-template.ts):

1. **„Subsemnatul" pentru o femeie.** Nu există câmp de gen în `profiles` (verificat în toate migrările).
   Decizia owner-ului: **se adaugă câmp de gen la înregistrare**.
2. **„cu datele de contact menționate mai sus"** — formulare neuzuală. Se înlocuiește cu
   „cu domiciliul în {adresă}". Adresa există deja (`profiles.address`, migrarea 008) și e deja în
   formularul wizardului (`solicitantAddress`).
3. **Mulțumirile lipite** de propoziția cu adresa de răspuns. Se separă.
4. **„Stimate reprezentant al {instituție}"** — acord greșit pentru instituții feminine
   („al Agenția"). Se înlocuiește cu o formulă invariabilă: „Stimată doamnă/Stimate domn,".

**Constrângere critică:** [`question-extraction.ts`](../../src/manager-544/requests/utils/question-extraction.ts)
parsează răspunsurile pe baza formulărilor fixe din template, inclusiv regexul `/datele de contact/i`
(linia 14). **Template-ul și extragerea se modifică în același task, niciodată separat**, altfel se
rupe extragerea întrebărilor.

**Compatibilitate înapoi:** cererile deja trimise conțin formularea veche. Extragerea trebuie să
recunoască **ambele** forme, nu doar cea nouă.

### F8 — Butonul „Trimite o cerere" deschide clientul de mail

**Cauză:** [`Procedura544.tsx:39`](../../components/public/institutie/Procedura544.tsx) pune un
`mailto:` pe adresa instituției imediat deasupra butonului (linia 89). Nu e intermitent — e un click
alăturat pe un element cu aspect de link discret.

**Fix:** adresa devine text copiabil, nu `mailto:`. În plus, butonul duce la `/register`, ceea ce
pentru un utilizator deja logat nu e formularul — devine `/requests/add`.

### F9 — Confirmare pe mail la aprobarea contului

**Cauză:** [`users.ts:43`](../../src/manager-544/admin/users.ts) doar setează `approved = true`.
Utilizatorul rămâne pe `/pending-approval` fără să afle nimic.

**Fix:** la aprobare se trimite un email prin acelaşi transport ca notificările existente.

### F10 — Titlul paginii

[`DashboardHeader.tsx:16`](../../src/manager-544/ui/dashboard/DashboardHeader.tsx) primește numele
complet și pe mobil se rupe pe două rânduri. Se afișează prenumele: `profile.first_name` există deja,
cu fallback pe primul cuvânt din `display_name`.

### F11 — Plural greșit (neraportat, vizibil în captură)

„Se vor trimite **1 emailuri separate**" —
[`PreviewModal.tsx:74`](../../src/manager-544/ui/requests/preview/PreviewModal.tsx).
`StickyActionBar` tratează deja corect cazul; modalul nu.

---

## 3. Loturi

Gruparea e **pe metodă de verificare**, nu pe zonă funcțională: fiecare lot are un criteriu unic de
acceptanță, deci poate fi respins sau acceptat singur.

| Lot | Findings | Cum se dovedește | Paralel |
|---|---|---|---|
| **L1 — funcții pure & date** | F1, F2 | vitest; aserțiune peste tot datasetul de 86 fișiere; fixturi `.eml` | ✅ 2 agenți, fișiere disjuncte |
| **L2 — termene** | F3 (backfill) | testul existent al planificatorului + dry-run citit de om | ❌ singur (scrie în DB) |
| **L3 — pipeline** | F4 | `tests/integration/matching.test.ts` + test unitar pe `process-email` | ❌ singur |
| **L4 — UI** | F5, F6, F8, F10, F11 | vitest (jsdom) + Playwright la final | ❌ serial (un singur cont de test) |
| **L5 — text & gen** | F7, F9 | vitest pe template + extragere, ambele formulări | ❌ singur (migrare + cuplaj) |

**Numere de migrare alocate aici, nu de agenți:** `019` = câmpul de gen (L5). E singura migrare din
val — backfill-ul termenelor e un script, nu o schimbare de schemă.
`018_conversation_handoff.sql` e încă neaplicată.

## 4. Criteriul global de acceptanță

`npm run check` verde pe arborele final, plus `npm run test:browser` o singură dată după integrarea
tuturor loturilor — nu per lot.
