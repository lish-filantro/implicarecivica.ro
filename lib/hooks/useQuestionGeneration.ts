'use client';

import { useState, useEffect, useRef } from 'react';
import type { QuestionCategory } from './useRequestWizard';

interface ProblemContext {
  ce: string;
  unde: string;
  cand: string;
}

interface CategoryState {
  questions: string[];
  isLoading: boolean;
  error: string | null;
}

const ALL_CATEGORIES: QuestionCategory[] = [
  'A_FINANCIAR',
  'B_RESPONSABILITATE',
  'C_PLANIFICARE',
  'D_MONITORIZARE',
  'E_CONFORMITATE',
];

interface UseQuestionGenerationOptions {
  problemContext: ProblemContext | null;
  institutionName: string | null;
  onCategoryReady?: (category: QuestionCategory, questions: string[]) => void;
}

export function useQuestionGeneration({
  problemContext,
  institutionName,
  onCategoryReady,
}: UseQuestionGenerationOptions) {
  const [categories, setCategories] = useState<Record<QuestionCategory, CategoryState>>({
    A_FINANCIAR: { questions: [], isLoading: false, error: null },
    B_RESPONSABILITATE: { questions: [], isLoading: false, error: null },
    C_PLANIFICARE: { questions: [], isLoading: false, error: null },
    D_MONITORIZARE: { questions: [], isLoading: false, error: null },
    E_CONFORMITATE: { questions: [], isLoading: false, error: null },
  });

  const hasStarted = useRef(false);
  const onCategoryReadyRef = useRef(onCategoryReady);
  onCategoryReadyRef.current = onCategoryReady;

  useEffect(() => {
    if (!problemContext || hasStarted.current) return;
    hasStarted.current = true;

    // Mark all as loading
    setCategories(prev => {
      const next = { ...prev };
      for (const cat of ALL_CATEGORIES) {
        next[cat] = { ...next[cat], isLoading: true };
      }
      return next;
    });

    // Fire 5 parallel API calls
    const promises = ALL_CATEGORIES.map(async (category) => {
      try {
        const response = await fetch('/api/questions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            problemContext,
            institutionName,
          }),
        });

        const data = await response.json();
        const questions: string[] = data.questions || [];

        setCategories(prev => ({
          ...prev,
          [category]: { questions, isLoading: false, error: null },
        }));

        // Notify parent to populate wizard
        if (questions.length > 0) {
          onCategoryReadyRef.current?.(category, questions);
        }

        return { category, questions };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Eroare necunoscută';
        setCategories(prev => ({
          ...prev,
          [category]: { questions: [], isLoading: false, error: errorMsg },
        }));
        return { category, questions: [] };
      }
    });

    Promise.allSettled(promises);
  }, [problemContext, institutionName]);

  const isAnyLoading = ALL_CATEGORIES.some(cat => categories[cat].isLoading);

  const totalGenerated = ALL_CATEGORIES.reduce(
    (sum, cat) => sum + categories[cat].questions.length,
    0,
  );

  return {
    categories,
    isAnyLoading,
    totalGenerated,
  };
}
