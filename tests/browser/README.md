# Teste în browser (Playwright)

Conduc aplicația reală în Chromium, cu conturi dedicate, și simulează o instituție care răspunde prin email.

```bash
npm run test:browser                      # împotriva http://localhost:3000 (pornește `npm run dev` înainte)
npm run test:browser:prod                 # împotriva https://www.implicarecivica.ro
npx playwright test tests/browser/03-request-lifecycle.spec.ts   # un singur fișier
npx playwright show-report                # raportul HTML al ultimei rulări
```

## Conturi

| Rol | Login | Adresă de platformă |
|---|---|---|
| Cetățean | `test-e2e@implicarecivica.ro` | `test-cetatean@implicarecivica.ro` |
| Instituție | `institutie-test@implicarecivica.ro` | aceeași |

`tests/browser/setup/global-setup.ts` le creează/actualizează cu cheia de serviciu din `.env.local`, le setează o parolă nouă la fiecare rulare (salvată în `tests/browser/.auth/creds.json`, ignorat de git; `E2E_PASSWORD` o fixează) și șterge cererile, sesiunile și emailurile lor.

Instituția e un utilizator obișnuit al platformei: emailurile trimise de cetățean ajung în inbox-ul ei pe drumul real (Resend → Cloudflare Email Routing → worker → R2 → webhook), iar testul răspunde din numele ei prin Resend, cu `In-Reply-To`, ca o registratură. Pentru că Resend trimite cu un expeditor tehnic în plicul SMTP, webhook-ul folosește antetul `From` din MIME.

## Fișiere

- `01-auth.spec.ts` — redirecționare la login, autentificare, parolă greșită, admin refuzat.
- `02-chat.spec.ts` — asistentul pe Anthropic real: STEP_1, rezumat, STEP_2 cu cardul instituției, „Pregătește cererile” → wizardul precompletat (pasul 2 cu setul de întrebări sau pasul 1 cu datele instituției; cere migrarea 018), răspunsul standard la mesaje în afara subiectului.
- `03-request-lifecycle.spec.ts` — wizard cu 2 întrebări → trimitere → sosire la instituție → confirmare ambiguă → „De revizuit” → asociere din UI → răspuns final potrivit după numărul de înregistrare → corectarea unei clasificări. Serial, ~8 minute.
- `04-pages.spec.ts` — emailuri, setări, feedback, pagina publică cu date deschise.

## Servicii atinse

Supabase (proiectul din `.env.local`, doar datele celor două conturi), Resend (câteva emailuri), Anthropic (chat + clasificare), Cloudflare (worker-ul de producție). Webhook-ul de inbound e cel din producție indiferent de `E2E_BASE_URL`, deci partea de pipeline a testului 03 reflectă codul deployat.
