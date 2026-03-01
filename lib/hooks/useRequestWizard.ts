'use client';

import { useState, useCallback, useMemo } from 'react';

export type QuestionCategory =
  | 'A_FINANCIAR'
  | 'B_RESPONSABILITATE'
  | 'C_PLANIFICARE'
  | 'D_MONITORIZARE'
  | 'E_CONFORMITATE';

export const CATEGORIES: { id: QuestionCategory; label: string; description: string }[] = [
  { id: 'A_FINANCIAR', label: 'A. Financiar', description: 'Buget, cheltuieli, contracte' },
  { id: 'B_RESPONSABILITATE', label: 'B. Responsabilitate', description: 'Cine răspunde, proceduri, termene' },
  { id: 'C_PLANIFICARE', label: 'C. Planificare', description: 'Planuri, buget viitor, calendar' },
  { id: 'D_MONITORIZARE', label: 'D. Monitorizare', description: 'Sesizări similare, rezolvări, indicatori' },
  { id: 'E_CONFORMITATE', label: 'E. Conformitate', description: 'Norme, audit, sancțiuni' },
];

export interface QuestionItem {
  id: string;
  category: QuestionCategory;
  text: string;
  isCustom: boolean;
  isEdited: boolean;
}

export interface WizardFormData {
  solicitantName: string;
  solicitantEmail: string;
  solicitantAddress: string;
  saveAddress: boolean;
  institutionName: string;
  institutionEmail: string;
}

interface ChatData {
  institutionName?: string | null;
  institutionEmail?: string | null;
  conversationId?: string | null;
}

interface UseRequestWizardOptions {
  initialChatData?: ChatData | null;
}

let questionIdCounter = 0;
function generateQuestionId(): string {
  questionIdCounter += 1;
  return `q_${Date.now()}_${questionIdCounter}`;
}

export function useRequestWizard({ initialChatData }: UseRequestWizardOptions = {}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [formData, setFormData] = useState<WizardFormData>({
    solicitantName: '',
    solicitantEmail: '',
    solicitantAddress: '',
    saveAddress: false,
    institutionName: initialChatData?.institutionName || '',
    institutionEmail: initialChatData?.institutionEmail || '',
  });

  const [questions, setQuestions] = useState<Record<QuestionCategory, QuestionItem[]>>({
    A_FINANCIAR: [],
    B_RESPONSABILITATE: [],
    C_PLANIFICARE: [],
    D_MONITORIZARE: [],
    E_CONFORMITATE: [],
  });

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  const conversationId = initialChatData?.conversationId || null;

  // --- Step navigation ---

  const setStep = useCallback((step: 1 | 2 | 3) => {
    setCurrentStep(step);
  }, []);

  // --- Form data ---

  const updateFormField = useCallback(<K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const initFormFromProfile = useCallback((profile: { display_name?: string | null; mailcow_email?: string | null; address?: string | null }) => {
    setFormData(prev => ({
      ...prev,
      solicitantName: prev.solicitantName || profile.display_name || '',
      solicitantEmail: profile.mailcow_email || '',
      solicitantAddress: prev.solicitantAddress || profile.address || '',
    }));
  }, []);

  // --- Questions ---

  const setQuestionsForCategory = useCallback((category: QuestionCategory, texts: string[]) => {
    const items: QuestionItem[] = texts.map(text => ({
      id: generateQuestionId(),
      category,
      text,
      isCustom: false,
      isEdited: false,
    }));
    setQuestions(prev => ({ ...prev, [category]: items }));
    // Auto-select all generated questions
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      items.forEach(item => next.add(item.id));
      return next;
    });
  }, []);

  const toggleQuestion = useCallback((id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllInCategory = useCallback((category: QuestionCategory) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      questions[category].forEach(q => next.add(q.id));
      return next;
    });
  }, [questions]);

  const deselectAllInCategory = useCallback((category: QuestionCategory) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      questions[category].forEach(q => next.delete(q.id));
      return next;
    });
  }, [questions]);

  const editQuestion = useCallback((id: string, newText: string) => {
    setQuestions(prev => {
      const updated = { ...prev };
      for (const cat of CATEGORIES) {
        updated[cat.id] = updated[cat.id].map(q =>
          q.id === id ? { ...q, text: newText, isEdited: !q.isCustom } : q
        );
      }
      return updated;
    });
  }, []);

  const addCustomQuestion = useCallback((category: QuestionCategory, text: string) => {
    const item: QuestionItem = {
      id: generateQuestionId(),
      category,
      text,
      isCustom: true,
      isEdited: false,
    };
    setQuestions(prev => ({
      ...prev,
      [category]: [...prev[category], item],
    }));
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions(prev => {
      const updated = { ...prev };
      for (const cat of CATEGORIES) {
        updated[cat.id] = updated[cat.id].filter(q => q.id !== id);
      }
      return updated;
    });
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // --- Computed ---

  const selectedCount = useMemo(() => selectedQuestionIds.size, [selectedQuestionIds]);

  const getSelectedQuestions = useCallback((): QuestionItem[] => {
    const all: QuestionItem[] = [];
    for (const cat of CATEGORIES) {
      for (const q of questions[cat.id]) {
        if (selectedQuestionIds.has(q.id)) {
          all.push(q);
        }
      }
    }
    return all;
  }, [questions, selectedQuestionIds]);

  const selectedCountByCategory = useMemo(() => {
    const counts: Record<QuestionCategory, number> = {
      A_FINANCIAR: 0,
      B_RESPONSABILITATE: 0,
      C_PLANIFICARE: 0,
      D_MONITORIZARE: 0,
      E_CONFORMITATE: 0,
    };
    for (const cat of CATEGORIES) {
      counts[cat.id] = questions[cat.id].filter(q => selectedQuestionIds.has(q.id)).length;
    }
    return counts;
  }, [questions, selectedQuestionIds]);

  // --- Validation ---

  const canProceedToStep2 = useMemo(() => {
    return !!(
      formData.solicitantName.trim() &&
      formData.solicitantEmail.trim() &&
      formData.solicitantAddress.trim() &&
      formData.institutionName.trim() &&
      formData.institutionEmail.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.institutionEmail)
    );
  }, [formData]);

  const canProceedToStep3 = useMemo(() => selectedCount > 0, [selectedCount]);

  return {
    currentStep,
    setStep,
    formData,
    updateFormField,
    initFormFromProfile,
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
    canProceedToStep2,
    canProceedToStep3,
    conversationId,
  };
}
