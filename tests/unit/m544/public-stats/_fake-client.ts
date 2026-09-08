/**
 * Minimal Supabase stand-in for the public-stats repo: records the table,
 * selected columns and filters (including `.or`) and resolves with `result`.
 */
export type Filter = { op: string; args: unknown[] };
export interface RecordedQuery {
  table: string;
  filters: Filter[];
  modifiers: string[];
}
export type QueryResult = { data: unknown; error: { message: string } | null };

class Builder implements PromiseLike<QueryResult> {
  constructor(private readonly q: RecordedQuery, private readonly result: QueryResult) {}
  select(cols = '*') {
    this.q.modifiers.push(`select:${cols}`);
    return this;
  }
  or(expr: string) {
    this.q.filters.push({ op: 'or', args: [expr] });
    return this;
  }
  then<R1 = QueryResult, R2 = never>(
    onfulfilled?: ((v: QueryResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

export function fakeSupabase(result: QueryResult) {
  const queries: RecordedQuery[] = [];
  return {
    queries,
    from(table: string) {
      const q: RecordedQuery = { table, filters: [], modifiers: [] };
      queries.push(q);
      return new Builder(q, result);
    },
  };
}
