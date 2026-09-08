# Manager 544 — îmbunătățiri sugerate după refactor

Colectate în timpul refactorului din 2026-09-08. Niciuna nu e implementată; sunt ordonate după impactul asupra utilizatorului.

## Fiabilitate operațională

1. **Revizuire manuală a potrivirilor.** Pipeline-ul marchează acum `emails.needs_review` când un răspuns nu poate fi atribuit cu certitudine (mai multe cereri deschise la aceeași instituție, „răspuns final" la o cerere neînregistrată). Lipsește interfața: un panou în Emailuri cu „Asociază manual la cererea X" și filtrul `needs_review`.
2. **Notificări la termene.** `profiles.notification_email` și `notification_deadline_days` există, dar nimic nu trimite emailul. Un cron zilnic (după `check-deadlines`) care trimite prin Resend un rezumat al cererilor cu termen în N zile și al celor depășite.
3. **Supabase auto-pauză (plan gratuit).** Proiectul s-a oprit din inactivitate și inbound-ul a fost respins în perioada aceea. Opțiuni: plan plătit sau cron zilnic de „ping" (cel de termene rezolvă asta odată ce `CRON_SECRET` e setat).
4. **Coadă de reîncercare pentru inbound.** Când webhook-ul eșuează, worker-ul respinge emailul (bounce către instituție). Mai bine: worker-ul acceptă întotdeauna și pune în coadă (Cloudflare Queues) cu reîncercare, iar R2 păstrează raw-ul 7 zile.
5. **Observabilitate.** Log drain (Vercel → Axiom/Logtail) și un contor de erori pe pipeline; acum `console.error` se pierde după 1 zi.

## Calitatea clasificării

6. **Mistral tier plătit** pentru `mistral-large-latest` (clasificare mai bună la documente ambigue) sau **Haiku pentru clasificare** (un singur furnizor AI; OCR rămâne Mistral). Testele de integrare pe cele 37 PDF-uri sunt gata să compare.
7. **Feedback pe clasificare.** Buton „clasificarea e greșită" în detaliul emailului care corectează categoria și înregistrează cazul pentru îmbunătățirea promptului.
8. **Termen legal corect.** Legea prevede 10 zile *lucrătoare* (și 30 la prelungire) de la înregistrare, nu calendaristice, iar interfața spune uneori „30 de zile". Un calendar de sărbători legale și un calcul pe zile lucrătoare.

## Chat și RAG

9. **Extindere index instituții.** Corpusul de 86 de tipuri e bun pentru jurisdicție, dar șabloanele (primării, ISJ, DSP) nu au emailuri concrete; Haiku le caută pe web. Un tabel `institutii_locale` (UAT → email 544 verificat) alimentat din răspunsurile primite ar elimina căutarea web pentru instituțiile deja contactate.
10. **Localitate cu sector.** `extractLocalitate` nu acceptă cifre („București, Sector 3" → nedetectat); minor, dar afectează ținta căutării web.
11. **Rate limit pe chat** (tokeni/utilizator/zi) — acum limitat doar de autentificare.

## Produs

12. **Deschidere date.** Pagina publică promite „date deschise din răspunsuri"; un export anonimizat (instituție, categorie, zile până la răspuns) pe `/institutii/[slug]`.
13. **Pagini publice sub 200 de linii.** `app/page.tsx`, `app/institutii/[slug]/page.tsx`, `lib/institutii.ts` au rămas peste limită (avertisment, nu eroare) fiind în afara scopului.
14. **Campanii.** Modulul are probleme de securitate documentate în audit (rute mutante protejate doar de „ești logat", XSS în inbox, RLS permisiv pe participări). Dacă modulul revine în producție, trebuie adus pe aceeași fundație (`shared/auth`, `shared/http`).
