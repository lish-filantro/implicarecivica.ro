'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { getProfile } from '@/lib/supabase/profile-queries';
import { updateProfile } from '@/lib/supabase/profile-queries';
import type { useRequestWizard } from '@/lib/hooks/useRequestWizard';

interface StepFormDataProps {
  wizard: ReturnType<typeof useRequestWizard>;
}

export function StepFormData({ wizard }: StepFormDataProps) {
  const { formData, updateFormField, initFormFromProfile, canProceedToStep2, setStep } = wizard;
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getProfile();
        if (profile) {
          initFormFromProfile(profile);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setProfileLoaded(true);
      }
    }
    loadProfile();
  }, [initFormFromProfile]);

  const handleContinue = async () => {
    if (!canProceedToStep2) return;

    // Save address to profile if checkbox is checked
    if (formData.saveAddress && formData.solicitantAddress.trim()) {
      try {
        await updateProfile({ address: formData.solicitantAddress.trim() });
      } catch (err) {
        console.error('Failed to save address:', err);
      }
    }

    setStep(2);
  };

  if (!profileLoaded) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Date cerere
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Completează datele necesare pentru formularea cererii.
        </p>
      </div>

      {/* Solicitant section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
          <div className="w-2 h-2 bg-civic-blue-500 rounded-full mr-2" />
          Date solicitant
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nume complet *
            </label>
            <input
              type="text"
              value={formData.solicitantName}
              onChange={(e) => updateFormField('solicitantName', e.target.value)}
              placeholder="Ion Popescu"
              className="w-full field-input"
            />
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              Email solicitant
              <Lock className="h-3 w-3 text-gray-400" />
            </label>
            <input
              type="email"
              value={formData.solicitantEmail}
              readOnly
              className="w-full field-input bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Adresă domiciliu *
          </label>
          <input
            type="text"
            value={formData.solicitantAddress}
            onChange={(e) => updateFormField('solicitantAddress', e.target.value)}
            placeholder="Str. Victoriei nr. 10, Bl. 5, Sc. A, Ap. 2, Sector 1, București"
            className="w-full field-input"
          />
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={formData.saveAddress}
              onChange={(e) => updateFormField('saveAddress', e.target.checked)}
              className="h-4 w-4 text-civic-blue-600 focus:ring-civic-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Salvează adresa pentru alte cereri
            </span>
          </label>
        </div>
      </div>

      {/* Institution section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
          <div className="w-2 h-2 bg-activist-orange-500 rounded-full mr-2" />
          Instituție destinatară
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Institution name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Numele instituției *
            </label>
            <input
              type="text"
              value={formData.institutionName}
              onChange={(e) => updateFormField('institutionName', e.target.value)}
              placeholder="Primăria Pitești"
              className="w-full field-input"
            />
          </div>

          {/* Institution email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email instituție *
            </label>
            <input
              type="email"
              value={formData.institutionEmail}
              onChange={(e) => updateFormField('institutionEmail', e.target.value)}
              placeholder="registratura@institutie.ro"
              className={`w-full field-input ${
                formData.institutionEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.institutionEmail)
                  ? 'border-protest-red-500 focus:ring-protest-red-500'
                  : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Continue button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleContinue}
          disabled={!canProceedToStep2}
          className="flex items-center gap-2 px-6 py-3 bg-civic-blue-600 hover:bg-civic-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
        >
          Continuă
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
