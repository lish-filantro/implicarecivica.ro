# Migrări Supabase

Migrările se aplică manual, în ordine, din **Supabase Dashboard → SQL Editor** (proiectul de producție). Nu există Supabase CLI legat de proiect.

| Fișier | Stare | Ce face |
|---|---|---|
| 001 … 015 | aplicate | schema inițială, chat, profile, emailuri, sesiuni, feedback, campanii, aprobare conturi |
| `016_refactor_hardening.sql` | **de aplicat** | RLS: o singură politică INSERT per tabel care cere `approved = true` (cele din 015 nu aveau efect, fiind combinate cu OR cu cele vechi); categorii `irelevant` și `redirectionat`; `emails.needs_review`; `requests.redirected_to`; indexuri pentru rate limit, procesare și termene |

## Cum aplici 016

1. Deschide SQL Editor, lipește conținutul fișierului, rulează. Este idempotent (poate fi rulat de mai multe ori).
2. Verifică politicile:
   ```sql
   SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND cmd = 'INSERT' ORDER BY tablename;
   ```
   Fiecare tabel (`requests`, `conversations`, `messages`, `request_sessions`, `feedback`, `emails`) trebuie să aibă exact o politică INSERT, cu numele care începe cu „Approved users".
3. Verifică coloanele noi:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'emails' AND column_name = 'needs_review';
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'redirected_to';
   ```

**016 este precondiție pentru branch-ul `refactor/manager-544`**: fără ea, clasificarea unui email ca `irelevant` sau `redirectionat` eșuează la scriere (CHECK vechi), iar `needs_review`/`redirected_to` lipsesc. Migrarea e compatibilă cu codul actual din `main`, deci se poate rula înainte de merge fără efecte negative.
