'use client';

import { useState, useCallback } from 'react';
import { useWizardForm } from './useWizardForm';
import { useWizardQuestions } from './useWizardQuestions';
import type { ChatData, WizardStep } from './types';

export type { QuestionCategory, QuestionItem, WizardFormData, ChatData, WizardStep } from './types';
export { CATEGORIES } from './types';

interface UseRequestWizardOptions {
  initialChatData?: ChatData | null;
  /** 2 when the chat hand-off and the profile make step 1 redundant. */
  initialStep?: WizardStep;
}

/**
 * The request wizard state: step navigation + form (step 1) + questions (step 2).
 * Thin composition of useWizardForm and useWizardQuestions; the return shape is
 * what StepFormData, StepSelectQuestions, PreviewModal and the pages consume.
 */
export function useRequestWizard({ initialChatData, initialStep = 1 }: UseRequestWizardOptions = {}) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const setStep = useCallback((step: WizardStep) => setCurrentStep(step), []);

  const form = useWizardForm(initialChatData);
  const questions = useWizardQuestions();
  const conversationId = initialChatData?.conversationId || null;

  return { currentStep, setStep, ...form, ...questions, conversationId };
}

export type RequestWizard = ReturnType<typeof useRequestWizard>;
