'use client';

import { useState, useEffect, useRef } from 'react';
import { getProfile, updateProfile } from '@m544/emails/profile-queries.client';
import type { RequestWizard } from './useRequestWizard';
import type { WizardProfile } from './types';

export interface StepFormProfileDeps {
  getProfile?: () => Promise<WizardProfile | null>;
  updateProfile?: (update: { address: string }) => Promise<unknown>;
}

const defaultDeps: Required<StepFormProfileDeps> = {
  getProfile: () => getProfile(),
  updateProfile: (update) => updateProfile(update),
};

type StepFormWizard = Pick<
  RequestWizard,
  'formData' | 'initFormFromProfile' | 'canProceedToStep2' | 'setStep'
>;

/**
 * Step 1 side effects: pre-fill the form from the profile on mount and, on
 * "Continuă", optionally persist the address before moving to step 2.
 */
export function useStepFormProfile(wizard: StepFormWizard, deps: StepFormProfileDeps = {}) {
  const { formData, initFormFromProfile, canProceedToStep2, setStep } = wizard;
  const [profileLoaded, setProfileLoaded] = useState(false);
  const depsRef = useRef({ ...defaultDeps, ...deps });
  depsRef.current = { ...defaultDeps, ...deps };

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const profile = await depsRef.current.getProfile();
        if (profile && !cancelled) {
          initFormFromProfile(profile);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (!cancelled) setProfileLoaded(true);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [initFormFromProfile]);

  const handleContinue = async () => {
    if (!canProceedToStep2) return;

    // Save address to profile if checkbox is checked
    if (formData.saveAddress && formData.solicitantAddress.trim()) {
      try {
        await depsRef.current.updateProfile({ address: formData.solicitantAddress.trim() });
      } catch (err) {
        console.error('Failed to save address:', err);
      }
    }

    setStep(2);
  };

  return { profileLoaded, handleContinue };
}
