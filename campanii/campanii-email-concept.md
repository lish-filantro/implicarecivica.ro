# Modul Campanii Email Civice — implicarecivica.ro
## Document Conceptual de Produs

---

## 1. Context & Motivație

Platforma implicarecivica.ro are deja funcționalitate de generare de cereri individuale (Law 544/2001) și un sistem de tracking pentru răspunsuri de la instituții. Campania de email pentru Parcul IOR a demonstrat că mobilizarea masivă prin email direct către aleși generează presiune civică reală și măsurabilă (1200+ mailuri trimise, 60+ ONG-uri).

Problema actuală: fiecare campanie nouă necesită implementare tehnică separată — o pagină custom hardcodată, o listă de adrese hardcodată, niciun sistem de tracking real. Platforma nu poate fi reutilizată fără intervenție de cod.

**Soluția:** un modul de campanii email integrat în implicarecivica.ro care permite crearea, publicarea și monitorizarea campaniilor de email civic — fără să scrii cod de fiecare dată.

---

## 2. Stack Tehnic Existent

- **Frontend + Backend:** Next.js pe Vercel
- **Bază de date:** Supabase (PostgreSQL)
- **Trimitere email outbound:** Resend (deja implementat pentru cereri 544)
- **Primire email inbound pentru tracking:** Cloudflare Email Routing pe subdomain dedicat
- **Autentificare:** sistem admin existent în platformă

Tot ce construim se integrează în aceste tehnologii existente. Nu adăugăm dependențe noi de infrastructură.

---

## 2.1 Arhitectura Subdomain & Tracking

### Subdomain dedicat: `campanii.implicarecivica.ro`

Toate paginile publice ale campaniilor și infrastructura de tracking se află pe acest subdomain. Motivele:

- Separare clară de platforma principală (`implicarecivica.ro`) unde trăiesc cererile 544
- MX records independente față de Resend — `campanii.implicarecivica.ro` poate avea propriile MX records pe Cloudflare Email Routing fără niciun conflict
- URL-uri curate și memorabile pentru distribuire pe social media

**DNS setup:**
```
campanii.implicarecivica.ro     → Vercel (paginile publice Next.js)
MX campanii.implicarecivica.ro  → Cloudflare Email Routing (inbound tracking)
```

### Adresa unică de tracking: `track@campanii.implicarecivica.ro`

O singură adresă pentru toate campaniile — nu creăm adrese noi per campanie. Identificarea campaniei se face prin **subiectul emailului**, care e definit de admin și stocat în DB.

### Identificarea campaniei via subiect email

Subiectul emailului e definit de admin la crearea campaniei și stocat în coloana `email_subject` din tabelul `campaigns`. La generarea mailto-ului, subiectul e populat exact așa cum e stocat — fără modificări, fără sufixuri adăugate.

Când Cloudflare Email Routing primește un email la `track@campanii.implicarecivica.ro`, Workerul extrage subiectul și face lookup direct în Supabase:

```sql
SELECT id FROM campaigns WHERE email_subject = '[subiectul primit]' AND status = 'active'
```

Găsește campania, incrementează contorul. Simplu.

**Singura regulă de business:** subiectele campaniilor active trebuie să fie unice. La salvarea unei campanii, platforma validează că subiectul nu există deja în DB și returnează eroare dacă e duplicat.

### Fluxul complet de tracking

```
Participant completează formularul pe campanii.implicarecivica.ro/[slug]
        ↓
Platforma generează mailto: cu:
  - to: toți consilierii campaniei
  - bcc: track@campanii.implicarecivica.ro
  - subject: exact subiectul definit de admin în DB
  - body: textul personalizat cu datele participantului
        ↓
Participantul apasă Send din propriul client de email (Gmail, Outlook, etc.)
        ↓
Cloudflare Email Routing primește emailul pe campanii.implicarecivica.ro
        ↓ (trigger Cloudflare Worker)
Worker extrage subiectul → lookup în Supabase după email_subject
Worker face POST la: implicarecivica.ro/api/campanii/track-inbound
        ↓
Next.js API Route găsește campania → marchează participarea ca "email_confirmed: true"
Incrementează confirmed_count pe campanie
        ↓
Contorul public se actualizează în timp real
```

**Cost total infrastructură tracking: 0 lei**
- Cloudflare Email Routing: gratuit, fără limită pe numărul de emailuri procesate
- Cloudflare Workers: 100,000 requesturi/zi gratis (mai mult decât suficient)
- Supabase: în limitele planului existent

---

## 3. User Roles în Modul

### Campaign Creator (Admin)
Persoana cu acces la panoul de administrare al platformei. Poate crea, edita, activa/dezactiva campanii. Are acces la toate statisticile.

### Participant (Public)
Orice cetățean care accesează URL-ul public al campaniei. Nu necesită cont. Completează un formular minimal și trimite emailul.

---

## 4. Fluxul Complet al Sistemului

### 4.1 Creare Campanie (Admin Flow)

Adminul accesează `/admin/campanii/new` și completează:

**Informații de bază:**
- Titlu campanie (ex: "Mărirea amenzii pentru tăiere ilegală copaci")
- Slug URL (auto-generat din titlu, editabil) → va genera `campanii.implicarecivica.ro/[slug]`
- Descriere scurtă (apare sub titlu pe pagina publică, max 300 caractere)
- Descriere lungă / context (text rich, apare ca secțiune "De ce contează" pe pagina publică)
- Imagine cover (upload sau URL extern)
- Organizație inițiatoare (text simplu, ex: "Mișcarea cetățenească Parcul IOR Dispare")
- Status: Draft / Activ / Arhivat
- Data expirare (opțional — campania se dezactivează automat)

**Destinatari (Recipients):**

O interfață tabelară unde adminul adaugă destinatarii emailului:

| Nume | Funcție | Email | Activ |
|------|---------|-------|-------|
| Ion Popescu | Consilier General | ion.popescu@pmb.ro | ✓ |
| Maria Ionescu | Consilier General | maria.ionescu@pmb.ro | ✓ |

Funcționalități:
- Adaugă individual (formular rapid: Nume + Funcție + Email)
- Import bulk via CSV (coloane: nume, functie, email)
- Dezactivare individuală fără ștergere (util dacă un consilier iese din funcție)
- Destinatarii sunt stocați per campanie (nu un registru global, dar pot fi copiați dintr-o campanie anterioară)
- Grupuri predefinite (opțional, faza 2): "Consiliul General București" ca set salvat

**Conținut Email:**

Adminul definește template-ul emailului pe care îl va trimite participantul:

- **Subiect email** (definit de admin — codul de tracking `[COD-CAMPANIE]` e adăugat automat la final, nu se vede în editor dar apare în emailul trimis)
- **Corp email** (editor text — nu rich text, email plain text e mai deliverabil) cu variabile:
  - `{nume_participant}` — înlocuit cu ce completează participantul
  - `{oras_participant}` — opțional, dacă formularul public îl cere
  - `{data}` — data curentă auto-inserată
  - `{organizatie}` — organizația inițiatoare
- **Semnătură** (text fix, apare după corpul emailului)
- Previzualizare live a emailului final în timp ce editezi

Participantul NU poate modifica conținutul emailului — trimite fix ce definește adminul, personalizat cu datele lui. Aceasta e o decizie deliberată pentru consistența mesajului civic.

**Setări formular public:**

Adminul alege ce date colectează de la participant:
- Nume complet (întotdeauna obligatoriu)
- Email (întotdeauna obligatoriu — pentru a trimite emailul)
- Oraș / Sector (opțional — toggle on/off)
- Cod poștal (opțional)
- Câmp text liber custom (opțional, ex: "De câți ani locuiești în București?")
- Consimțământ GDPR (checkbox obligatoriu, text editabil de admin)

**Call-to-action și social sharing:**

- Titlu buton de submit (ex: "Trimite emailul acum!")
- Mesaj de succes după trimitere (text editabil)
- Opțional: linkuri social sharing pre-configurate (Facebook, WhatsApp, Twitter/X)
- Opțional: URL de redirect după trimitere (ex: pagina de donații sau grup Facebook)

---

### 4.2 Pagina Publică a Campaniei

URL: `campanii.implicarecivica.ro/[slug]`

Layout-ul paginii publice (generat dinamic din datele campaniei):

**Hero Section:**
- Imagine cover
- Titlu campanie (mare, impactant)
- Organizație inițiatoare
- Contor live: "X persoane au trimis emailul până acum" (număr real din DB)
- Scurtă descriere

**Secțiunea "De ce contează":**
- Textul lung de context definit de admin
- Opțional: statistici vizuale (ex: infografic simplu hardcodat sau imagine upload)

**Formularul de participare:**
- Câmpurile definite de admin (Nume, Email, opționale)
- Previzualizare email colapsabilă (acordeon): "Vezi emailul pe care îl vei trimite" → se expandează și arată conținutul exact al emailului, personalizat cu numele lor dacă l-au completat deja
- Butonul de submit: "Trimite emailul acum"
- Text mic sub buton cu numărul de destinatari: "Emailul va ajunge la toți cei 55 de consilieri generali"

**Ce se întâmplă la submit:**

Există două abordări, adminul alege per campanie:

**Opțiunea A — Mailto (simplu, 100% deliverabil):**
La click pe submit, se generează un link `mailto:` cu toți destinatarii în `to:` sau `bcc:`, subiectul și corpul pre-completat. Se deschide clientul de email al participantului. Participantul apasă Send din propriul client.

Avantaj: emailul vine de la adresa reală a participantului → mult mai mult impact, nu poate fi filtrat ca spam, nu costă nimic.
Dezavantaj: participantul trebuie să apese Send manual, și nu putem confirma 100% că a trimis.

**Opțiunea B — Trimitere via Resend (controlat, tracking complet):**
La submit, backend-ul trimite emailul via Resend API, folosind ca `from` o adresă de pe domeniul platformei (ex: `campanie@implicarecivica.ro`), cu participantul în reply-to. Se înregistrează trimiterea în DB.

Avantaj: tracking complet, confirmăm că s-a trimis, putem număra exact.
Dezavantaj: emailul vine de la o adresă generică, nu de la cetățean direct. Trebuie monitorizat abuse.

**Recomandare pentru MVP:** Opțiunea A (mailto) cu tracking optimist — la click pe submit înregistrăm intenția în DB (chiar dacă nu avem confirmare 100%). Opțiunea B ca feature ulterior pentru campanii care au nevoie de tracking strict.

**Flow submit Opțiunea A (cu BCC tracking):**
1. Participantul completează formularul
2. Validare frontend (câmpuri obligatorii)
3. POST la `/api/campanii/[slug]/participa` cu datele formularului
4. Server înregistrează participarea în Supabase cu status `email_pending` (timestamp, IP anonimizat, oraș dacă există)
5. Server returnează succes + conținutul emailului personalizat + codul de tracking al campaniei
6. Frontend generează link mailto cu:
   - `to:` toți destinatarii campaniei
   - `bcc:` track@campanii.implicarecivica.ro
   - `subject:` subiectul definit de admin + `[COD-CAMPANIE]` la final
   - `body:` textul personalizat
7. Se deschide clientul de email al participantului — apasă Send
8. Cloudflare primește copia BCC → Worker parsează codul → API marchează participarea ca `email_confirmed: true`
9. Contorul public crește cu 1 (contorizăm confirmed, nu pending)
10. Frontend afișează mesajul de succes + opțiuni social sharing

---

### 4.3 Dashboard Admin — Statistici Campanie

Adminul accesează `/admin/campanii/[slug]/stats` și vede:

**Metrici principale:**
- Total participări (submit-uri de formular)
- Grafic participări în timp (zi cu zi) — vizualizare simplă cu recharts sau similar
- Participări pe orașe / sectoare (pie chart dacă câmpul e activ)
- Rata de creștere (ieri vs alaltăieri, săptămâna asta vs precedenta)

**Date participanți:**
- Tabel cu participările: Timestamp | Nume | Oraș | Email (mascat: a***@gmail.com)
- Export CSV (pentru verificare sau follow-up)
- Filtru pe dată

**Email performance (Opțiunea B):**
- Delivered / Bounced / Failed per destinatar
- Dacă un destinatar email bounced → alertă vizuală cu recomandare de actualizare adresă

---

## 5. Schema Bază de Date (Supabase)

### Tabel: `campaigns`
```
id                  uuid PRIMARY KEY
slug                text UNIQUE NOT NULL
title               text NOT NULL
short_description   text
long_description    text
cover_image_url     text
organization        text
email_subject       text NOT NULL UNIQUE  -- trebuie să fie unic între campaniile active
email_body          text NOT NULL
email_signature     text
submit_button_text  text DEFAULT 'Trimite emailul acum!'
success_message     text
redirect_url        text
sending_method      text CHECK (in ('mailto', 'resend')) DEFAULT 'mailto'
form_fields         jsonb  -- care câmpuri sunt active
gdpr_text           text
status              text CHECK (in ('draft', 'active', 'archived')) DEFAULT 'draft'
expires_at          timestamptz
participation_count int DEFAULT 0  -- counter optimist (la submit formular)
confirmed_count     int DEFAULT 0  -- counter real (la primire BCC confirmat)
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### Tabel: `campaign_recipients`
```
id              uuid PRIMARY KEY
campaign_id     uuid REFERENCES campaigns(id)
name            text NOT NULL
role            text  -- ex: "Consilier General"
email           text NOT NULL
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### Tabel: `campaign_participations`
```
id              uuid PRIMARY KEY
campaign_id     uuid REFERENCES campaigns(id)
participant_name    text NOT NULL
participant_email   text  -- stocat sau nu, decizie GDPR
participant_city    text
custom_field_value  text
ip_hash             text  -- SHA256 al IP, nu IP-ul raw
user_agent_hash     text  -- pentru deduplicare
email_status        text CHECK (in ('pending', 'confirmed')) DEFAULT 'pending'
  -- pending = formularul a fost submituit dar nu știm dacă a trimis emailul
  -- confirmed = Cloudflare a primit BCC-ul, emailul a fost trimis cu certitudine
confirmed_at        timestamptz  -- când a sosit confirmarea BCC
created_at          timestamptz DEFAULT now()
```

### Tabel: `campaign_email_events` (doar pentru Opțiunea B — Resend)
```
id              uuid PRIMARY KEY
participation_id    uuid REFERENCES campaign_participations(id)
recipient_id        uuid REFERENCES campaign_recipients(id)
resend_message_id   text
status              text  -- sent, delivered, bounced, failed
event_at            timestamptz
```

---

## 6. Anti-Abuse & GDPR

**Deduplicare:**
- Rate limiting per IP: max 3 participări per IP per 24h per campanie
- Hash IP (nu stocăm IP raw) pentru conformitate GDPR
- Opțional: reCAPTCHA v3 invizibil pe formular

**GDPR:**
- Text de consimțământ editabil de admin — trebuie să fie clar ce date colectăm și de ce
- Participantul poate solicita ștergerea datelor lui (endpoint standard)
- Emailurile participanților stocate doar dacă e necesar (Opțiunea B); pentru Opțiunea A putem alege să nu le stocăm deloc
- Privacy policy link în footer-ul fiecărei pagini de campanie

**Abuse:**
- Admin poate dezactiva o campanie instant (status → archived)
- Raport de anomalii: dacă 50+ participări vin în sub 1 minut → alertă pentru admin

---

## 7. Interfața Admin — Rezumat Pagini

```
/admin/campanii                    → Listă toate campaniile (draft/active/archived) + buton "Campanie nouă"
/admin/campanii/new                → Wizard creare campanie (3 pași: Info → Destinatari → Email & Formular)
/admin/campanii/[slug]/edit        → Editare campanie existentă
/admin/campanii/[slug]/stats       → Dashboard statistici
/admin/campanii/[slug]/recipients  → Management destinatari (CRUD + import CSV)
```

---

## 8. Pagini Publice

```
campanii.implicarecivica.ro/                → Index campanii active (landing page civic)
campanii.implicarecivica.ro/[slug]          → Pagina publică a campaniei
campanii.implicarecivica.ro/[slug]/succes   → Pagina de confirmare după submit
```

**Notă DNS:** subdomain-ul `campanii.implicarecivica.ro` are:
- **A/CNAME records** → Vercel (pentru paginile Next.js)
- **MX records** → Cloudflare Email Routing (pentru tracking inbound)

Cele două pot coexista pe același subdomain fără conflict — A/CNAME e pentru trafic HTTP, MX e pentru trafic email, sunt protocoale complet separate.

---

## 9. Funcționalități MVP (Lansare)

Prioritizate pentru prima versiune funcțională:

1. CRUD campanii în admin (creare, editare, arhivare)
2. Validare unicitate subiect email la salvare campanie
3. Management destinatari cu import CSV
4. Pagină publică dinamică pe `campanii.implicarecivica.ro/[slug]`
5. Formular participare cu validare
6. Trimitere via mailto cu BCC automat la `track@campanii.implicarecivica.ro`
7. Cloudflare Worker care parsează subiectul și confirmă participarea via API
8. Două contoare pe pagina publică: "X au trimis formularul" (optimist) și "Y confirmate" (real)
9. Previzualizare email personalizat pe pagina publică
10. Dashboard statistici de bază (total + grafic în timp + rată confirmare)
11. Rate limiting anti-abuse

---

## 10. Funcționalități Faza 2 (Post-MVP)

- Trimitere email via Resend (Opțiunea B) cu tracking complet
- Import destinatari din registre predefinite (ex: "Consiliul General București" salvat o dată și reutilizat)
- Notificări pentru admin (email daily summary cu statistici)
- A/B testing pe subiectul emailului
- Pagina index publică `/campanii` cu toate campaniile active
- Widget embed (iframe) pentru site-uri terțe (ex: parculiordispare.ro poate embeda formularul)
- Campanii cu destinatar unic și mesaj personalizat per destinatar (pentru cereri 544/2001 în masă)

---

## 11. Integrare cu Platforma Existentă

Modulul de campanii este complementar cu funcționalitatea de cereri 544/2001 existentă:

- **Cereri 544:** individuale, unui singur destinatar, cu tracking legal al răspunsului
- **Campanii email:** colective, către mulți destinatari simultan, pentru presiune civică

Același sistem de autentificare admin. Același Supabase. Același Resend (când e cazul). Stilistic, paginile publice moștenesc designul platformei (navbar, footer, culori).

---

*Document generat pentru echipa de dezvoltare implicarecivica.ro*
*Versiune: 1.2 — Simplificat tracking: identificare campanie prin lookup direct pe email_subject în DB, fără cod adițional*
