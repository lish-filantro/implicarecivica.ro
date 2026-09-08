'use client';

import { useState, useEffect, useRef } from 'react';
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

export type FetchQuestions = (
  category: QuestionCategory,
  problemContext: ProblemContext,
  institutionName: string | null,
) => Promise<string[]>;

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

interface UseQuestionGenerationOptions {
  problemContext: ProblemContext | null;
  institutionName: string | null;
  onCategoryReady?: (category: QuestionCategory, questions: string[]) => void;
  fetchQuestions?: FetchQuestions;
}

/**
 * Generates questions for all 5 categories in parallel, once, as soon as a
 * problem context is available. Each category reports its own loading/error state.
 */
export function useQuestionGeneration({
  problemContext,
  institutionName,
  onCategoryReady,
  fetchQuestions,
}: UseQuestionGenerationOptions) {
  const [categories, setCategories] = useState<Record<QuestionCategory, CategoryState>>(() =>
    perCategory<CategoryState>(() => ({ questions: [], isLoading: false, error: null })),
  );

  const hasStarted = useRef(false);
  const onCategoryReadyRef = useRef(onCategoryReady);
  onCategoryReadyRef.current = onCategoryReady;
  const fetchRef = useRef(fetchQuestions);
  fetchRef.current = fetchQuestions;

  useEffect(() => {
    if (!problemContext || hasStarted.current) return;
    hasStarted.current = true;
    const load = fetchRef.current ?? createQuestionsFetcher();

    setCategories((prev) => {
      const next = { ...prev };
      for (const cat of CATEGORY_IDS) next[cat] = { ...next[cat], isLoading: true };
      return next;
    });

    const promises = CATEGORY_IDS.map(async (category) => {
      try {
        const questions = await load(category, problemContext, institutionName);
        setCategories((prev) => ({ ...prev, [category]: { questions, isLoading: false, error: null } }));
        if (questions.length > 0) onCategoryReadyRef.current?.(category, questions);
        return { category, questions };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Eroare necunoscută';
        setCategories((prev) => ({ ...prev, [category]: { questions: [], isLoading: false, error: errorMsg } }));
        return { category, questions: [] };
      }
    });

    Promise.allSettled(promises);
  }, [problemContext, institutionName]);

  const isAnyLoading = CATEGORY_IDS.some((cat) => categories[cat].isLoading);
  const totalGenerated = CATEGORY_IDS.reduce((sum, cat) => sum + categories[cat].questions.length, 0);

  return { categories, isAnyLoading, totalGenerated };
}
