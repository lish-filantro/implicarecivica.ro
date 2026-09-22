/**
 * One-shot backfill: recompute `deadline_date` / `extension_date` for every registered request,
 * using the corrected legal arithmetic in `@m544/shared/utils/legal-days`.
 *
 * Why it is needed. Nothing in the application rewrites an existing row: `pipeline/status`
 * writes `deadline_date` only when it is still empty, and only on the transition to
 * `inregistrate`. Rows registered before the fix therefore still carry deadlines computed in
 * business days — roughly four days late for the 10-day term and up to a fortnight for the
 * 30-day one, always in the institution's favour.
 *
 * Why answered requests are included as well. Their deadline is not archive material:
 * `public-stats/aggregate.ts` compares `response_received_date` against
 * `extension_date ?? deadline_date` to produce `answered_within_deadline_pct`, published on the
 * institution pages as „Răspunsuri în termen". A deadline that is too late makes the comparison
 * succeed too often, so the public figure overstates how well institutions comply. For an
 * answered request the write is purely evidentiary — it changes no live obligation, the request
 * is closed — but it is exactly what the published number is computed from.
 *
 * What this script does NOT do: it never changes `status`. A request that the old arithmetic
 * flagged `delayed` too early keeps that status even though its corrected deadline may not have
 * passed. That gap is currently theoretical: comparing the old and the new arithmetic over every
 * registration day from 2015 to 2035, the new deadline is always earlier than or equal to the old
 * one for N = 10 and N = 30 — the only terms this script writes — so no row can be rescued by the
 * recomputation. It would become real if the 5-day refusal term (`refusalDeadline`, today unused)
 * were ever wired into the pipeline; a status reset would then have to be designed deliberately.
 *
 * Why a Node script and not a SQL migration: the movable feasts (Orthodox Easter, Pentecost)
 * would have to be reimplemented in PL/pgSQL, and a second implementation of that algorithm is
 * precisely how the two drift apart. This imports the one rule that exists.
 *
 * Usage — dry run first, it is the default and writes nothing:
 *
 *     npx tsx tools/backfill-legal-deadlines.ts
 *     npx tsx tools/backfill-legal-deadlines.ts --apply
 *
 * Reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment
 * (`.env.local` is loaded automatically). `--from-json <file>` replaces the database with a
 * JSON array of rows, for rehearsing the report without touching Supabase; it implies a dry run.
 *
 * `request_sessions.nearest_deadline` needs no separate pass: migration 006 fires
 * `on_request_session_change` on `AFTER INSERT OR UPDATE OF status, session_id, deadline_date,
 * extension_date`, so every write here recalculates the owning session. On an answered row the
 * recalculation is wasted but harmless — `recalculate_session_status` takes
 * `MIN(COALESCE(extension_date, deadline_date)) FILTER (WHERE status NOT IN ('answered'))`, so an
 * answered request's deadline never reaches `nearest_deadline` in the first place.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { standardDeadline, extendedDeadline } from '@m544/pipeline/status/deadlines';

loadEnv({ path: '.env.local', quiet: true });

/** The columns the backfill reads. `date_received` is the registration date, art. 16 alin. (2). */
export interface BackfillRow {
  id: string;
  date_received: string | null;
  deadline_date: string | null;
  extension_date: string | null;
  status: string;
}

export interface PlannedChange {
  id: string;
  /** Kept so the report can separate live obligations from rows that only feed the statistics. */
  status: string;
  dateReceived: string;
  oldDeadline: string | null;
  newDeadline: string;
  oldExtension: string | null;
  newExtension: string | null;
  /** Whole days the old deadline ran past the legal one; null when the row had no deadline. */
  driftDays: number | null;
}

export interface BackfillPlan {
  changes: PlannedChange[];
  unchanged: number;
  failures: Array<{ id: string; reason: string }>;
}

const DAY_MS = 86_400_000;

/**
 * Whole calendar days between two stored deadlines. Both are compared on their date component:
 * the old rows were written at midnight and the new ones at the end of the day, so comparing the
 * instants would round a full day of drift down to zero.
 */
function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`)) / DAY_MS);
}

/** „1 zi" / „3 zile" — evită „1 zile" în raport. */
const zile = (n: number) => (Math.abs(n) === 1 ? `${n} zi` : `${n} zile`);

/**
 * Whether two stored timestamps denote the same instant. String equality is not enough:
 * PostgREST serialises a `TIMESTAMPTZ` with an explicit offset (`…T23:59:59.999+00:00`), while
 * the arithmetic here produces `…T23:59:59.999Z`. Compared as strings, a row that already holds
 * the correct deadline looks like a change of zero days — which empties the „neschimbate" count
 * and dilutes the drift statistics that the dry run exists to show.
 */
const sameInstant = (a: string | null, b: string | null) =>
  a === b || (!!a && !!b && Date.parse(a) === Date.parse(b));

/**
 * Pure planning step: what each row should become. Never throws for a single bad row — a
 * malformed `date_received` is recorded as a failure and the rest of the batch continues.
 */
export function planBackfill(rows: readonly BackfillRow[]): BackfillPlan {
  const changes: PlannedChange[] = [];
  const failures: BackfillPlan['failures'] = [];
  let unchanged = 0;

  for (const row of rows) {
    try {
      if (!row.date_received) {
        failures.push({ id: row.id, reason: 'date_received is null' });
        continue;
      }
      const newDeadline = standardDeadline(row.date_received);
      // An extension is only recomputed when the institution actually asked for one.
      const newExtension = row.extension_date ? extendedDeadline(row.date_received) : null;

      if (sameInstant(newDeadline, row.deadline_date) && sameInstant(newExtension, row.extension_date)) {
        unchanged += 1;
        continue;
      }
      changes.push({
        id: row.id,
        status: row.status,
        dateReceived: row.date_received,
        oldDeadline: row.deadline_date,
        newDeadline,
        oldExtension: row.extension_date,
        newExtension,
        driftDays: row.deadline_date ? dayDiff(newDeadline, row.deadline_date) : null,
      });
    } catch (err) {
      failures.push({ id: row.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { changes, unchanged, failures };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

const TABLE_HEADER =
  'id                                    înregistrare  termen vechi → termen nou   Δ zile  prelungire';

function tableFor(changes: readonly PlannedChange[]): string[] {
  const lines = [TABLE_HEADER];
  for (const c of changes) {
    const ext = c.oldExtension ? `${day(c.oldExtension)} → ${day(c.newExtension)}` : '—';
    const drift = c.driftDays === null ? '—' : String(c.driftDays);
    lines.push(
      `${c.id.padEnd(36)}  ${day(c.dateReceived)}    ${day(c.oldDeadline)} → ${day(c.newDeadline)}   ` +
        `${drift.padStart(5)}   ${ext}`,
    );
  }
  return lines;
}

export function formatPlan(plan: BackfillPlan, total: number): string {
  // The two groups answer different questions: the open ones change obligations that are still
  // running, the answered ones only change the published „Răspunsuri în termen" percentage.
  const open = plan.changes.filter((c) => c.status !== 'answered');
  const closed = plan.changes.filter((c) => c.status === 'answered');

  const lines: string[] = [];
  lines.push(`Cereri citite: ${total}`);
  lines.push(
    `De modificat: ${plan.changes.length} (deschise: ${open.length} · răspunse: ${closed.length}) · ` +
      `neschimbate: ${plan.unchanged} · erori: ${plan.failures.length}`,
  );

  if (open.length > 0) {
    lines.push('');
    lines.push('── Cereri deschise — termene în curs, se schimbă o obligaţie vie ──');
    lines.push(...tableFor(open));
  }

  if (closed.length > 0) {
    lines.push('');
    lines.push('── Cereri răspunse — cererea e închisă; schimbă doar statistica publică „Răspunsuri în termen" ──');
    lines.push(...tableFor(closed));
  }

  // Rows that never had a deadline have no drift to report; counting them as 0 would flatten
  // the median and understate how far the old arithmetic ran past the legal term.
  const drifts = plan.changes.map((c) => c.driftDays).filter((d): d is number => d !== null);
  if (drifts.length > 0) {
    lines.push('');
    lines.push(`Ecart faţă de termenul legal — maxim: ${zile(Math.max(...drifts))} · median: ${zile(median(drifts))}`);
  }

  if (plan.failures.length > 0) {
    lines.push('');
    lines.push('Rânduri nerezolvate:');
    for (const f of plan.failures) lines.push(`  ${f.id}: ${f.reason}`);
  }

  return lines.join('\n');
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const fromJsonAt = argv.indexOf('--from-json');
  const fromJson = fromJsonAt === -1 ? null : argv[fromJsonAt + 1];
  const apply = argv.includes('--apply') && !fromJson;

  let rows: BackfillRow[];
  if (fromJson) {
    rows = JSON.parse(readFileSync(fromJson, 'utf8')) as BackfillRow[];
    console.log(`Sursă: ${fromJson} (fără conexiune la Supabase)\n`);
  } else {
    // Every registered request, whatever its status. Only `deadline_date` / `extension_date` are
    // rewritten; `status` is never touched, by any row.
    const { data, error } = await serviceClient()
      .from('requests')
      .select('id, date_received, deadline_date, extension_date, status')
      .not('date_received', 'is', null);
    if (error) throw new Error(`Citirea cererilor a eşuat: ${error.message}`);
    rows = (data ?? []) as BackfillRow[];
  }

  const plan = planBackfill(rows);
  console.log(formatPlan(plan, rows.length));

  if (!apply) {
    console.log('\nDRY RUN — nu s-a scris nimic. Rulează din nou cu --apply pentru a aplica.');
    return;
  }

  const client = serviceClient();
  const writeFailures: Array<{ id: string; reason: string }> = [];
  let written = 0;
  for (const c of plan.changes) {
    const patch: Record<string, string> = { deadline_date: c.newDeadline };
    if (c.newExtension) patch.extension_date = c.newExtension;
    const { error } = await client.from('requests').update(patch).eq('id', c.id);
    if (error) writeFailures.push({ id: c.id, reason: error.message });
    else written += 1;
  }

  console.log(`\nAplicat: ${written} rânduri actualizate.`);
  if (writeFailures.length > 0) {
    console.log('Scrieri eşuate:');
    for (const f of writeFailures) console.log(`  ${f.id}: ${f.reason}`);
    process.exitCode = 1;
  }
}

// Only run when invoked as a script. `planBackfill` / `formatPlan` are imported by their unit
// test, and importing this module must not open a Supabase connection.
const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entryPoint === import.meta.url) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
