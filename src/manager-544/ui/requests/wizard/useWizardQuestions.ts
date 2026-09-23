'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { CATEGORIES, perCategory } from './types';
import type { QuestionCategory, QuestionItem } from './types';
import type { OutgoingAttachment } from '@m544/requests/attachments';
import { uploadAttachment } from '../attachments/upload';
import { useQuestionAttachments, type QuestionAttachmentsApi } from './useQuestionAttachments';

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

interface UseWizardQuestionsOptions {
  /** Injectabil pentru teste; implicit urcă în bucket-ul `email-attachments`. */
  upload?: (file: File) => Promise<OutgoingAttachment>;
}

/** Step 2 of the wizard: generated/custom questions per category and their selection. */
export function useWizardQuestions({ upload = uploadAttachment }: UseWizardQuestionsOptions = {}) {
  const [questions, setQuestionsState] = useState<QuestionMap>(() => perCategory<QuestionItem[]>(() => []));
  // Oglinda sincronă a întrebărilor, pentru bugetul de ataşamente citit între două încărcări.
  // Toate modificările trec prin `setQuestions`, care aplică acelaşi updater funcţional şi aici.
  const questionsRef = useRef(questions);
  const setQuestions = useCallback((fn: (prev: QuestionMap) => QuestionMap) => {
    questionsRef.current = fn(questionsRef.current);
    setQuestionsState(fn);
  }, []);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const nextId = useRef(createQuestionIdGenerator());

  const attachments = useQuestionAttachments({
    attachmentsOf: (id) => {
      for (const cat of CATEGORIES) {
        const q = questionsRef.current[cat.id].find((x) => x.id === id);
        if (q) return q.attachments ?? [];
      }
      return null;
    },
    updateAttachments: (id, fn) =>
      setQuestions((prev) => mapAll(prev, (items) => items.map((q) => (q.id === id ? { ...q, attachments: fn(q.attachments ?? []) } : q)))),
    upload: (file) => upload(file),
  });
  const { pending: pendingAttachments, add, retry, dismiss, remove, clear: clearAttachments } = attachments;
  const questionAttachments = useMemo<QuestionAttachmentsApi>(
    () => ({ pending: pendingAttachments, add, retry, dismiss, remove }),
    [pendingAttachments, add, retry, dismiss, remove],
  );

  // Replaces the category's generated questions with the new texts; custom ones (and their selection) stay.
  // Generated questions start unselected: the user picks what to send (recommended at most 10 at once).
  // The replaced ids leave the selection and the pending uploads too: a replaced question with a
  // failed file would otherwise block the preview forever, with no row left to dismiss.
  const setQuestionsForCategory = useCallback((category: QuestionCategory, texts: string[]) => {
    const items: QuestionItem[] = texts.map((text) => ({
      id: nextId.current(),
      category,
      text,
      isCustom: false,
      isEdited: false,
    }));
    const replaced = questionsRef.current[category].filter((q) => !q.isCustom).map((q) => q.id);
    setQuestions((prev) => ({ ...prev, [category]: [...items, ...prev[category].filter((q) => q.isCustom)] }));
    if (replaced.length) {
      setSelectedQuestionIds((prev) => withIds(prev, replaced, false));
      for (const id of replaced) clearAttachments(id);
    }
  }, [setQuestions, clearAttachments]);

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
  }, [setQuestions]);

  const addCustomQuestion = useCallback((category: QuestionCategory, text: string) => {
    const item: QuestionItem = { id: nextId.current(), category, text, isCustom: true, isEdited: false };
    setQuestions((prev) => ({ ...prev, [category]: [...prev[category], item] }));
    setSelectedQuestionIds((prev) => withIds(prev, [item.id], true));
  }, [setQuestions]);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => mapAll(prev, (items) => items.filter((q) => q.id !== id)));
    setSelectedQuestionIds((prev) => withIds(prev, [id], false));
    clearAttachments(id);
  }, [setQuestions, clearAttachments]);

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

  // Un fişier în curs de încărcare sau eşuat opreşte previzualizarea — altfel ar pleca o cerere
  // fără fişierul pe care omul crede că l-a ataşat. Contează doar întrebările bifate: una
  // deselectată nu pleacă, dar rândul ei eşuat rămâne şi blochează din nou dacă e rebifată.
  // Una bifată al cărei picker e doar ascuns (categorie strânsă, editare, pasul 1) blochează.
  // Doar întrebările care încă există: un id rămas în urmă n-ar mai avea rând de scos.
  const hasBusyAttachments = useMemo(() => {
    const existing = new Set(CATEGORIES.flatMap((cat) => questions[cat.id].map((q) => q.id)));
    return Object.keys(pendingAttachments).some((id) => selectedQuestionIds.has(id) && existing.has(id));
  }, [pendingAttachments, selectedQuestionIds, questions]);

  const canProceedToStep3 = useMemo(
    () => selectedCount > 0 && !hasBusyAttachments,
    [selectedCount, hasBusyAttachments],
  );

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
    questionAttachments,
    hasBusyAttachments,
    selectedCount,
    selectedCountByCategory,
    getSelectedQuestions,
    canProceedToStep3,
  };
}
