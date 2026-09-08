/**
 * Minimal in-memory stand-in for the parts of the Supabase JS client used by
 * the session-scoped handlers (auth.getUser + a chainable query builder).
 * Each awaited query is answered by `respond(query)`; the recorded queries let
 * tests assert on the exact filters/payloads the code sent.
 */
import type { User } from '@supabase/supabase-js';

export type Filter = { op: string; args: unknown[] };
export interface RecordedQuery {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  filters: Filter[];
  modifiers: string[]; // single, maybeSingle, head, order, limit...
  count?: string;
}
export type QueryResult = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type Responder = (q: RecordedQuery) => QueryResult;

export function fakeAuth(user: User | null) {
  return { getUser: async () => ({ data: { user }, error: user ? null : { message: 'no session' } }) };
}

/** Chainable builder: every method records itself and returns the builder; awaiting it resolves via `respond`. */
class Builder implements PromiseLike<QueryResult> {
  constructor(private readonly q: RecordedQuery, private readonly respond: Responder) {}
  private f(op: string, ...args: unknown[]) {
    this.q.filters.push({ op, args });
    return this;
  }
  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.q.op !== 'insert' && this.q.op !== 'update') this.q.op = 'select';
    if (opts?.count) this.q.count = opts.count;
    if (opts?.head) this.q.modifiers.push('head');
    this.q.modifiers.push(`select:${cols ?? '*'}`);
    return this;
  }
  insert(payload: unknown) { this.q.op = 'insert'; this.q.payload = payload; return this; }
  update(payload: unknown) { this.q.op = 'update'; this.q.payload = payload; return this; }
  delete() { this.q.op = 'delete'; return this; }
  eq(c: string, v: unknown) { return this.f('eq', c, v); }
  neq(c: string, v: unknown) { return this.f('neq', c, v); }
  ilike(c: string, v: unknown) { return this.f('ilike', c, v); }
  gte(c: string, v: unknown) { return this.f('gte', c, v); }
  is(c: string, v: unknown) { return this.f('is', c, v); }
  not(c: string, o: string, v: unknown) { return this.f('not', c, o, v); }
  order(c: string, o?: unknown) { this.q.modifiers.push(`order:${c}:${JSON.stringify(o)}`); return this; }
  limit(n: number) { this.q.modifiers.push(`limit:${n}`); return this; }
  single() { this.q.modifiers.push('single'); return this; }
  maybeSingle() { this.q.modifiers.push('maybeSingle'); return this; }
  then<R1 = QueryResult, R2 = never>(
    onfulfilled?: ((v: QueryResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.respond(this.q)).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabase {
  auth: ReturnType<typeof fakeAuth>;
  from(table: string): Builder;
  queries: RecordedQuery[];
}

export function fakeSupabase(user: User | null, respond: Responder = () => ({ data: null, error: null })): FakeSupabase {
  const queries: RecordedQuery[] = [];
  return {
    auth: fakeAuth(user),
    queries,
    from(table: string) {
      const q: RecordedQuery = { table, op: 'select', filters: [], modifiers: [] };
      queries.push(q);
      return new Builder(q, respond);
    },
  };
}

/** Route responses by table (and optionally op). */
export function byTable(map: Record<string, QueryResult | ((q: RecordedQuery) => QueryResult)>): Responder {
  return (q) => {
    const entry = map[`${q.table}:${q.op}`] ?? map[q.table];
    if (!entry) return { data: null, error: null };
    return typeof entry === 'function' ? entry(q) : entry;
  };
}
