/**
 * Vector Store abstraction for RAG
 *
 * Local test:  ChromaVectorStore  (connects to chroma server)
 * Production:  SupabaseVectorStore (pgvector, swap when migrating)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERFACES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface VectorStore {
  search(query: string, topK?: number): Promise<SearchResult[]>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ChromaDB (local test)
// Requires: pip install chromadb && chroma run --path ./app/chat/chroma_db --port 8000
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class ChromaVectorStore implements VectorStore {
  private chromaUrl: string;
  private collectionName: string;
  private collection: any = null;

  constructor(collectionName: string, chromaUrl = 'http://localhost:8000') {
    this.collectionName = collectionName;
    this.chromaUrl = chromaUrl;
  }

  private async ensureCollection() {
    if (this.collection) return;
    const { ChromaClient } = await import('chromadb');
    const client = new ChromaClient({ path: this.chromaUrl });
    this.collection = await client.getCollection({ name: this.collectionName });
  }

  async search(query: string, topK = 5): Promise<SearchResult[]> {
    try {
      await this.ensureCollection();

      const results = await this.collection.query({
        queryTexts: [query],
        nResults: topK,
      });

      if (!results.documents?.[0]) return [];

      return results.documents[0].map((doc: string, i: number) => ({
        id: results.ids[0][i] || `${i}`,
        content: doc || '',
        metadata: results.metadatas?.[0]?.[i] || {},
        // ChromaDB returns distances (lower = more similar) — convert to similarity score
        score: results.distances?.[0]?.[i] != null
          ? 1 - results.distances[0][i]
          : 0,
      }));
    } catch (error) {
      console.error('ChromaDB search failed:', error);
      return [];
    }
  }

  /**
   * List all collections in the ChromaDB instance.
   * Useful for discovery — run this first to find your collection name.
   */
  static async listCollections(chromaUrl = 'http://localhost:8000'): Promise<string[]> {
    const { ChromaClient } = await import('chromadb');
    const client = new ChromaClient({ path: chromaUrl });
    const collections = await client.listCollections();
    return collections.map((c: any) => typeof c === 'string' ? c : c.name);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase pgvector (production — swap in when migrating)
//
// SQL Setup:
//
//   create extension if not exists vector;
//
//   create table documents (
//     id bigserial primary key,
//     content text not null,
//     metadata jsonb default '{}',
//     embedding vector(1536)  -- match your embedding model dimension
//   );
//
//   create index on documents
//     using hnsw (embedding vector_cosine_ops)
//     with (m = 16, ef_construction = 64);
//
//   create or replace function match_documents(
//     query_embedding vector(1536),
//     match_threshold float default 0.7,
//     match_count int default 5
//   ) returns table (
//     id bigint,
//     content text,
//     metadata jsonb,
//     similarity float
//   ) language sql stable as $$
//     select id, content, metadata,
//       1 - (embedding <=> query_embedding) as similarity
//     from documents
//     where 1 - (embedding <=> query_embedding) > match_threshold
//     order by embedding <=> query_embedding
//     limit match_count;
//   $$;
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
