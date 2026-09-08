# manager-544

Codul managerului de cereri Legea 544/2001, organizat pe module (vezi `docs/plans/2026-09-08-manager-544-refactor-design.md`).

Reguli: fișiere sub 200 de linii (ESLint `max-lines`), fără `any`, dependențele (DB, clienți AI, clock) se injectează ca parametri cu valori implicite, fiecare funcție exportată are test în `tests/unit/m544/`.

Import cu alias: `import { requireUser } from '@m544/shared/auth'`.
