'use client';

import { useState, useCallback, useMemo } from 'react';
import { isValidInstitutionEmail } from './types';
import type { ChatData, WizardFormData, WizardProfile } from './types';

/** Pure step-1 validation: every field filled and a plausible institution email. */
export function canProceedFromForm(formData: WizardFormData): boolean {
  return !!(
    formData.solicitantName.trim() &&
    formData.solicitantEmail.trim() &&
    formData.solicitantAddress.trim() &&
    formData.institutionName.trim() &&
    formData.institutionEmail.trim() &&
    isValidInstitutionEmail(formData.institutionEmail) &&
    formData.sessionName.trim()
  );
}

export function initialFormData(chatData?: ChatData | null): WizardFormData {
  return {
    solicitantName: '',
    solicitantEmail: '',
    solicitantAddress: '',
    saveAddress: false,
    institutionName: chatData?.institutionName || '',
    institutionEmail: chatData?.institutionEmail || '',
    sessionName: '',
  };
}

/** Step 1 of the wizard: the form fields, profile pre-fill and validation. */
export function useWizardForm(initialChatData?: ChatData | null) {
  const [formData, setFormData] = useState<WizardFormData>(() => initialFormData(initialChatData));

  const updateFormField = useCallback(<K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Name and address only fill empty fields; the sender email always comes from the profile.
  const initFormFromProfile = useCallback((profile: WizardProfile) => {
    setFormData((prev) => ({
      ...prev,
      solicitantName: prev.solicitantName || profile.display_name || '',
      solicitantEmail: profile.mailcow_email || '',
      solicitantAddress: prev.solicitantAddress || profile.address || '',
    }));
  }, []);

  const canProceedToStep2 = useMemo(() => canProceedFromForm(formData), [formData]);

  return { formData, updateFormField, initFormFromProfile, canProceedToStep2 };
}
