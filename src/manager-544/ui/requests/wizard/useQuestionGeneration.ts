'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { QuestionSet } from '@m544/shared/types/questions';
import { CATEGORY_IDS, perCategory } from './types';
import type { QuestionCategory } from './types';

export interface ProblemContext {
  ce: string;
  unde: string;
  cand: string;
}

export interface CategoryState {
  questions: string[];
  isLoading: boolean;
  error: string | null;
}

/** Per-category loader (the Haiku endpoint), kept as the fallback path. */
export type FetchQuestions = (
  category: QuestionCategory,
  problemContext: ProblemContext,
  institutionName: string | null,
) => Promise<string[]>;

/** Where the whole set comes from: the conversation (cached on its hand-off) or an existing session. */
export type GenerationSource = { conversationId: string } | { sessionId: string };

export interface QuestionSetResult {
  categories: QuestionSet;
  model: string;
  cached?: boolean;
}

/** Whole-set loader (the chat-model endpoint). `refresh` bypasses the cache. */
export type FetchSet = (source: GenerationSource, refresh: boolean) => Promise<QuestionSetResult>;

export type GenerationMode = 'idle' | 'preloaded' | 'set' | 'legacy';

export const SET_ERROR_MESSAGE = 'Generarea întrebărilor a eșuat. Reîncearcă.';
export const FALLBACK_NOTICE =
  'Setul complet nu a putut fi generat; întrebările au fost generate pe categorii cu modelul de rezervă.';
/** Failed set attempts after which "Reîncearcă" switches to the per-category generator. */
export const SET_ATTEMPTS_BEFORE_FALLBACK = 2;

/** Default loader: POST /api/questions/generate, one call per category. */
export function createQuestionsFetcher(fetchFn: typeof fetch = (...args) => fetch(...args)): FetchQuestions {
  return async (category, problemContext, institutionName) => {
    const response = await fetchFn('/api/questions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, problemContext, institutionName }),
    });
    const data: { questions?: string[] } = await response.json();
    return data.questions || [];
  };
}

/** Default set loader: POST /api/questions/generate-set with the source; the API error message is thrown. */
export function createSetFetcher(fetchFn: typeof fetch = (...args) => fetch(...args)): FetchSet {
  return async (source, refresh) => {
    const response = await fetchFn(`/api/questions/generate-set${refresh ? '?refresh=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source),
    });
    const data: { categories?: QuestionSet; model?: string; cached?: boolean; error?: string } = await response
      .json()
      .catch(() => ({}));
    if (!response.ok) throw new Error(data.error || SET_ERROR_MESSAGE);
    return { categories: data.categories ?? perCategory<string[]>(() => []), model: data.model ?? '', cached: Boolean(data.cached) };
  };
}

interface UseQuestionGenerationOptions {
  problemContext: ProblemContext | null;
  institutionName: string | null;
  onCategoryReady?: (category: QuestionCategory, questions: string[]) => void;
  fetchQuestions?: FetchQuestions;
  /** When set, the whole set is generated in one call (chat model) instead of per category. */
  source?: GenerationSource | null;
  /** Questions already generated for this conversation: applied immediately, nothing is fetched. */
  preloaded?: QuestionSet | null;
  fetchSet?: FetchSet;
  /** false: nothing happens until `start()` (e.g. a "Generează" button). Default true. */
  autoStart?: boolean;
}

function hasAny(set: QuestionSet | null | undefined): set is QuestionSet {
  return Boolean(set) && CATEGORY_IDS.some((c) => (set as QuestionSet)[c]?.length > 0);
}

/**
 * Generates the wizard's questions, once, as soon as a source or a problem
 * context is available:
 *   preloaded set → applied as is · source → one set call (retry; after
 *   SET_ATTEMPTS_BEFORE_FALLBACK failures the per-category generator takes over)
 *   · problem context only → per-category generator (legacy path).
 * Each category reports its own loading/error state.
 */
export function useQuestionGeneration(options: UseQuestionGenerationOptions) {
  const { problemContext, institutionName, source = null, preloaded = null, autoStart = true } = options;

  const [categories, setCategories] = useState<Record<QuestionCategory, CategoryState>>(() =>
    perCategory<CategoryState>(() => ({ questions: [], isLoading: false, error: null })),
  );
  const [setError, setSetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>('idle');

  const hasStarted = useRef(false);
  const attempts = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const markAllLoading = useCallback((isLoading: boolean) => {
    setCategories((prev) => {
      const next = { ...prev };
      for (const cat of CATEGORY_IDS) next[cat] = { ...next[cat], isLoading, error: null };
      return next;
    });
  }, []);

  const applySet = useCallback((set: QuestionSet) => {
    setCategories(() => {
      const next = perCategory<CategoryState>(() => ({ questions: [], isLoading: false, error: null }));
      for (const cat of CATEGORY_IDS) next[cat] = { questions: set[cat] ?? [], isLoading: false, error: null };
      return next;
    });
    for (const cat of CATEGORY_IDS) {
      const questions = set[cat] ?? [];
      if (questions.length > 0) optionsRef.current.onCategoryReady?.(cat, questions);
    }
  }, []);

  const runLegacy = useCallback(
    (ctx: ProblemContext, institution: string | null) => {
      const load = optionsRef.current.fetchQuestions ?? createQuestionsFetcher();
      markAllLoading(true);
      const promises = CATEGORY_IDS.map(async (category) => {
        try {
          const questions = await load(category, ctx, institution);
          setCategories((prev) => ({ ...prev, [category]: { questions, isLoading: false, error: null } }));
          if (questions.length > 0) optionsRef.current.onCategoryReady?.(category, questions);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Eroare necunoscută';
          setCategories((prev) => ({ ...prev, [category]: { questions: [], isLoading: false, error: errorMsg } }));
        }
      });
      void Promise.allSettled(promises);
    },
    [markAllLoading],
  );

  const runSet = useCallback(
    async (src: GenerationSource, refresh: boolean) => {
      const load = optionsRef.current.fetchSet ?? createSetFetcher();
      setSetError(null);
      markAllLoading(true);
      try {
        const result = await load(src, refresh);
        setModel(result.model || null);
        applySet(result.categories);
      } catch (err) {
        attempts.current += 1;
        markAllLoading(false);
        setSetError(err instanceof Error && err.message ? err.message : SET_ERROR_MESSAGE);
      }
    },
    [applySet, markAllLoading],
  );

  /** Begins generation (or, once started with a source, regenerates bypassing the cache). */
  const start = useCallback(() => {
    const { source: src, preloaded: pre, problemContext: ctx, institutionName: inst } = optionsRef.current;
    if (hasStarted.current) {
      if (src) void runSet(src, true);
      return;
    }
    hasStarted.current = true;
    if (hasAny(pre)) {
      setMode('preloaded');
      applySet(pre);
      return;
    }
    if (src) {
      setMode('set');
      void runSet(src, false);
      return;
    }
    if (ctx) {
      setMode('legacy');
      runLegacy(ctx, inst ?? null);
    }
  }, [applySet, runLegacy, runSet]);

  /** "Reîncearcă" after a failed set: regenerate, or fall back to the per-category generator. */
  const retry = useCallback(() => {
    const { source: src, problemContext: ctx, institutionName: inst } = optionsRef.current;
    if (!src) return;
    if (attempts.current >= SET_ATTEMPTS_BEFORE_FALLBACK && ctx) {
      setSetError(null);
      setNotice(FALLBACK_NOTICE);
      setMode('legacy');
      runLegacy(ctx, inst ?? null);
      return;
    }
    void runSet(src, true);
  }, [runLegacy, runSet]);

  useEffect(() => {
    if (!autoStart || hasStarted.current) return;
    if (hasAny(preloaded) || source || problemContext) start();
  }, [autoStart, preloaded, source, problemContext, institutionName, start]);

  const isAnyLoading = CATEGORY_IDS.some((cat) => categories[cat].isLoading);
  const totalGenerated = CATEGORY_IDS.reduce((sum, cat) => sum + categories[cat].questions.length, 0);

  return { categories, isAnyLoading, totalGenerated, setError, notice, model, mode, start, retry };
}
