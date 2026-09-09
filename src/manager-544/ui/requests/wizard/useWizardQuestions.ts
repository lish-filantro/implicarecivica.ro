'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { CATEGORIES, perCategory } from './types';
import type { QuestionCategory, QuestionItem } from './types';

/**
 * Ids unique per hook instance (counter) and across instances (random token).
 * Replaces the old module-level counter, which leaked state between renders and tests.
 */
export function createQuestionIdGenerator(token: string = Math.random().toString(36).slice(2, 8)) {
  let counter = 0;
  return () => {
    counter += 1;
    return `q_${token}_${counter}`;
  };
}

type QuestionMap = Record<QuestionCategory, QuestionItem[]>;

function mapAll(map: QuestionMap, fn: (items: QuestionItem[]) => QuestionItem[]): QuestionMap {
  const updated = { ...map };
  for (const cat of CATEGORIES) updated[cat.id] = fn(updated[cat.id]);
  return updated;
}

function withIds(prev: Set<string>, ids: string[], add: boolean): Set<string> {
  const next = new Set(prev);
  for (const id of ids) {
    if (add) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Step 2 of the wizard: generated/custom questions per category and their selection. */
export function useWizardQuestions() {
  const [questions, setQuestions] = useState<QuestionMap>(() => perCategory<QuestionItem[]>(() => []));
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const nextId = useRef(createQuestionIdGenerator());

  // Replaces the category's generated questions with the new texts (custom ones stay) and auto-selects the new ones.
  const setQuestionsForCategory = useCallback((category: QuestionCategory, texts: string[]) => {
    const items: QuestionItem[] = texts.map((text) => ({
      id: nextId.current(),
      category,
      text,
      isCustom: false,
      isEdited: false,
    }));
    setQuestions((prev) => ({ ...prev, [category]: [...items, ...prev[category].filter((q) => q.isCustom)] }));
    setSelectedQuestionIds((prev) => withIds(prev, items.map((i) => i.id), true));
  }, []);

  const toggleQuestion = useCallback((id: string) => {
    setSelectedQuestionIds((prev) => withIds(prev, [id], !prev.has(id)));
  }, []);

  const selectAllInCategory = useCallback((category: QuestionCategory) => {
    setSelectedQuestionIds((prev) => withIds(prev, questions[category].map((q) => q.id), true));
  }, [questions]);

  const deselectAllInCategory = useCallback((category: QuestionCategory) => {
    setSelectedQuestionIds((prev) => withIds(prev, questions[category].map((q) => q.id), false));
  }, [questions]);

  // Editing a generated question marks it "(editat)"; custom ones stay plain.
  const editQuestion = useCallback((id: string, newText: string) => {
    setQuestions((prev) =>
      mapAll(prev, (items) => items.map((q) => (q.id === id ? { ...q, text: newText, isEdited: !q.isCustom } : q))),
    );
  }, []);

  const addCustomQuestion = useCallback((category: QuestionCategory, text: string) => {
    const item: QuestionItem = { id: nextId.current(), category, text, isCustom: true, isEdited: false };
    setQuestions((prev) => ({ ...prev, [category]: [...prev[category], item] }));
    setSelectedQuestionIds((prev) => withIds(prev, [item.id], true));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => mapAll(prev, (items) => items.filter((q) => q.id !== id)));
    setSelectedQuestionIds((prev) => withIds(prev, [id], false));
  }, []);

  const selectedCount = useMemo(() => selectedQuestionIds.size, [selectedQuestionIds]);

  // Selected questions in category order (A -> E), then insertion order.
  const getSelectedQuestions = useCallback((): QuestionItem[] => {
    const all: QuestionItem[] = [];
    for (const cat of CATEGORIES) {
      for (const q of questions[cat.id]) {
        if (selectedQuestionIds.has(q.id)) all.push(q);
      }
    }
    return all;
  }, [questions, selectedQuestionIds]);

  const selectedCountByCategory = useMemo(() => {
    const counts = perCategory(() => 0);
    for (const cat of CATEGORIES) {
      counts[cat.id] = questions[cat.id].filter((q) => selectedQuestionIds.has(q.id)).length;
    }
    return counts;
  }, [questions, selectedQuestionIds]);

  const canProceedToStep3 = useMemo(() => selectedCount > 0, [selectedCount]);

  return {
    questions,
    setQuestionsForCategory,
    selectedQuestionIds,
    toggleQuestion,
    selectAllInCategory,
    deselectAllInCategory,
    editQuestion,
    addCustomQuestion,
    removeQuestion,
    selectedCount,
    selectedCountByCategory,
    getSelectedQuestions,
    canProceedToStep3,
  };
}
