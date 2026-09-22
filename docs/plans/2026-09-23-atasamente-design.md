# Atașamente la cererile 544 — specificație

**Stare:** design aprobat de owner pe 2026-09-23 („continuă" la designul prezentat). Specificația
așteaptă revizuirea owner-ului înainte de planul de implementare.

## 1. Ce și de ce

Raportul de testare din 2026-09-22: *„nu văd nicio variantă de a atașa imagini, PDF-uri"*. Cererile
544 au nevoie des de o dovadă — poza gropii, un act emis anterior, o cerere veche la care se face
referire. Azi utilizatorul nu are cum să le trimită.

**Decizii ale owner-ului:**

- atașamentele se pun **pe fiecare întrebare**, nu pe toată sesiunea;
- sunt valabile pe **ambele drumuri** de la „Cerere nouă": editorul liber și întrebările generate din chat.

**Criteriul de succes:** instituția primește fișierul atașat la emailul întrebării respective, iar
utilizatorul îl vede și îl poate descărca în firul cererii, lângă emailul trimis.

## 2. Ce există deja și nu se reconstruiește

Verificat în cod pe 2026-09-23:

| Piesă | Unde | Folosită ca atare |
|---|---|---|
| Bucket `email-attachments`, privat | `supabase/migrations/004_emails.sql:87-106` | da |
| RLS: utilizatorul încarcă și citește doar sub `<uid>/…` | aceeași migrare | da |
| Coloana `emails.attachments JSONB` | `004_emails.sql:23` | da |
| Afișarea în firul emailului, cu descărcare | `src/manager-544/ui/emails/EmailAttachments.tsx` — citește `att.path` | da |
| Ruta de descărcare semnată | `app/api/emails/attachments` — acceptă orice cale care începe cu `<uid>/` | da |
| SDK Resend 6.9.3: `attachments: [{ filename, content: Buffer \| string, contentType }]` | `node_modules/resend` | da |

**Nu e nevoie de migrare.** Nu e nevoie nici de componentă nouă de afișare: dacă emailul trimis își
salvează atașamentele cu `path`, ele apar în fir și se descarcă prin mecanismul de azi.

## 3. Abordarea

**Aleasă — încărcare directă în storage, trimitere de pe server cu clientul utilizatorului.**
Browserul urcă fișierul în `email-attachments` imediat ce e ales. La trimitere, serverul primește
doar căile, descarcă fișierele **cu clientul Supabase al utilizatorului** și le trimite prin Resend.

De ce clientul utilizatorului și nu cel de service: RLS-ul existent garantează că serverul nu poate
descărca, în numele unui utilizator, fișierul altuia. O cale ghicită sau modificată în cerere
eșuează la storage, nu la o verificare pe care am putea-o uita.

**Respinse:**

- *Fișiere ca base64 în corpul cererii către `/api/emails/send`.* Vercel taie corpul cererilor către
  funcții la 4,5 MB, adică sub o singură poză de pe telefon.
- *Resend preia fișierul singur, dintr-un URL semnat (`attachments[].path`).* Serverul n-ar mai
  descărca nimic, dar livrarea ar depinde de faptul că Resend ajunge la storage în fereastra de
  valabilitate a URL-ului, iar un eșec acolo e greu de văzut din aplicație.

## 4. Designul

### 4.1 Model

Fiecare întrebare primește o listă de atașamente, pe tipul care circulă deja prin wizard, coada de
trimitere și previzualizare (`QuestionItem` din `src/manager-544/ui/requests/wizard/types.ts`):

```ts
interface OutgoingAttachment {
  /** `<uid>/outgoing/<uuid>/<nume-sigur>` — primul segment e folderul RLS. */
  path: string;
  name: string;
  /** MIME declarat de browser; serverul îl verifică pe octeți, nu îl crede. */
  type: string;
  size: number;
}

interface QuestionItem {
  // …câmpurile de azi
  attachments?: OutgoingAttachment[];
}
```

Tipul comun `Email` (`src/manager-544/shared/types/email.ts:23`) declară azi atașamentele ca
`{ name, size, type }`, fără `path`, deși atât cele primite cât și componenta de afișare folosesc
`path`. Tipul se lărgește cu `path?: string` — altfel atașamentele trimise ar fi corecte în bază,
dar nedeclarate în tip.

Numele fișierului se curăță cu `safeFilename` din `src/manager-544/inbound/webhook/attachments.ts`,
cel folosit azi pentru atașamentele primite. Nu se scrie un al doilea sanitizor.

### 4.2 Limite

| Limită | Valoare | Motiv |
|---|---|---|
| Tipuri | JPEG, PNG, WebP, PDF | ce trimite omul ca dovadă; tot ce e în plus e suprafață de risc |
| Pe fișier | 10 MB | o poză de telefon încape cu marjă |
| Pe întrebare | 20 MB în total | Resend acceptă 40 MB pe email **după** base64 (+~33%) → ~27 MB, plus corpul |
| Număr pe întrebare | 5 | previne încărcări accidentale în masă; limită de interfață, nu tehnică |

Limitele se verifică **de două ori**: în browser, ca omul să afle imediat, și pe server, pentru că
browserul nu e de încredere. Tipul se verifică pe server după primii octeți ai fișierului descărcat
(`%PDF`, `FF D8 FF`, `89 50 4E 47`, `RIFF…WEBP`), nu după extensie sau MIME-ul declarat.

Pe iPhone, pozele sunt HEIC. Câmpul de încărcare cere explicit `image/jpeg,image/png,image/webp`;
Safari pe iOS ar trebui să convertească atunci în JPEG la încărcare — **neverificat încă, se verifică
pe un telefon real înainte de a declara funcționalitatea gata.** HEIC nu se acceptă direct; dacă
conversia nu se întâmplă, omul primește eroarea de tip, nu un fișier stricat.

### 4.3 Interfață

- **„📎 Atașează"** pe fiecare întrebare, pe ambele drumuri: în editorul liber (drumul manual) și
  în lista întrebărilor generate (drumul din chat). Sub întrebare apar fișierele, fiecare cu nume,
  mărime și „✕".
- **Încărcarea** pornește la alegere, cu progres. Eroarea (tip, mărime, rețea) se vede lângă fișier.
  Întrebarea nu poate fi trimisă cât timp are un fișier în curs de încărcare sau eșuat.
- **Previzualizarea** (`PreviewEmailCard`) arată pentru fiecare email ce fișiere pleacă odată cu el.
- **Firul cererii** afișează atașamentele trimise prin `EmailAttachments`, fără nicio schimbare, fiindcă
  emailul salvează `path`.

### 4.4 Trimitere

`/api/emails/send` primește un câmp opțional nou:

```ts
attachments?: Array<{ path: string; name: string; type: string; size: number }>
```

Pe server, în ordine:

1. fiecare `path` trebuie să înceapă cu `<uid>/outgoing/` — altfel 400;
2. numărul și suma mărimilor declarate respectă limitele — altfel 400;
3. fiecare fișier se descarcă cu clientul utilizatorului; mărimea **reală** și tipul după octeți se
   verifică din nou;
4. se trimite prin Resend cu `attachments: [{ filename, content: Buffer, contentType }]`;
5. rândul emailului trimis salvează `attachments: [{ name, size, type, path }]`.

**Dacă un atașament nu poate fi descărcat sau nu trece verificarea, emailul întrebării NU pleacă.**
Răspunsul e o eroare cu numele fișierului, pe care coada de trimitere o afișează la întrebarea
respectivă. Nu se trimite niciodată, tăcut, o cerere fără fișierul pe care omul l-a atașat.

Ruta primește `export const maxDuration = 60`. Descărcarea a până la 20 MB din storage și trimiterea
lor către Resend pot depăși limita implicită a platformei.

Coada de trimitere (`send-queue-store.ts`, `buildEmailRequest` din `send-requests.ts`) transportă
atașamentele fiecărei întrebări până la apelul ei. Fluxul „adaugă cereri la o sesiune existentă"
trece prin aceeași coadă, deci e acoperit fără cod separat.

### 4.5 Ce rămâne deliberat în afară

- **Curățenia fișierelor abandonate** — urcate, dar a căror cerere nu a mai fost trimisă. Rămân în
  storage. Se rezolvă ulterior, cu un cron care șterge `<uid>/outgoing/*` mai vechi de N zile fără
  un email trimis care să le refere.
- **Atașamente la răspunsuri** (`ComposeModal`, `parent_email_id`). API-ul le va accepta, fiindcă e
  același endpoint, dar interfața pentru ele nu intră acum.
- **Imaginile inline în corpul emailului** (`contentId`). Atașamentele pleacă doar ca fișiere.

## 5. Erori, pe scurt

| Situație | Unde se vede | Efect |
|---|---|---|
| Tip sau mărime greșită la alegere | lângă fișier, în browser | fișierul nu se încarcă |
| Rețea căzută la încărcare | lângă fișier, cu „Reîncearcă" | întrebarea nu se poate trimite |
| Cale străină, limită depășită, tip fals pe octeți | eroare de la server, la întrebare | emailul nu pleacă |
| Fișier șters din storage între încărcare și trimitere | eroare de la server, la întrebare | emailul nu pleacă |
| Resend respinge emailul | eroarea existentă a cozii | ca azi |

## 6. Testare

- **Unitare:**
  - validarea (tip după octeți, mărimi, număr, prefixul căii) ca funcții pure;
  - `buildEmailRequest` cu atașamente;
  - handler-ul de trimitere cu storage și Resend false: fișier descărcat și trimis, cale străină
    respinsă, tip fals respins, fișier lipsă → emailul nu pleacă;
  - componentele de interfață (jsdom, fără `jest-dom` — vezi CLAUDE.md).
- **Browser:** un pas nou în `tests/browser/03-request-lifecycle.spec.ts`. Se atașează un PDF la o
  întrebare, se trimite, se verifică faptul că emailul ajuns în registratura contului-instituție are
  atașamentul, apoi că fișierul apare în firul cererii.
- **Fără schimbări** la e2e și integration: pipeline-ul de primire nu e atins.

## 7. Dependențe de alte lucrări

Depinde de ecranul „Cerere nouă" și de editorul liber de pe drumul manual (ramura
`feat/cerere-noua-contacte-atasamente`, în lucru), fiindcă „📎 Atașează" se pune și în acel editor.
Implementarea atașamentelor pornește după ce editorul e integrat.
