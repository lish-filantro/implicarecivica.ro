/**
 * Vector Store — Supabase pgvector
 */

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface VectorStore {
  search(query: string, topK?: number): Promise<SearchResult[]>;
}

export class SupabaseVectorStore implements VectorStore {
  private supabase: any;
  private embedFn: (text: string) => Promise<number[]>;

  constructor(
    supabaseClient: any,
    embedFn: (text: string) => Promise<number[]>,
  ) {
    this.supabase = supabaseClient;
    this.embedFn = embedFn;
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    try {
      const embedding = await this.embedFn(query);

      const { data, error } = await this.supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: topK,
      });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: String(row.id),
        content: row.content,
        metadata: row.metadata || {},
        score: row.similarity,
      }));
    } catch (error) {
      console.error('Supabase vector search failed:', error);
      return [];
    }
  }
}
