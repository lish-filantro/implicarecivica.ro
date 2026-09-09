'use client';

import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { isValidInstitutionEmail } from './types';
import type { WizardFormData } from './types';
import { missingFormFields } from './handoff-entry';
import { useStepFormProfile } from './useStepFormProfile';
import type { StepFormProfileDeps } from './useStepFormProfile';
import type { RequestWizard } from './useRequestWizard';

interface StepFormDataProps {
  wizard: RequestWizard;
  /** Test seam for the profile loader/saver (defaults to the Supabase browser queries). */
  profileDeps?: StepFormProfileDeps;
  /** Entered from the chat with gaps: mark the required fields still empty. */
  highlightMissing?: boolean;
}

const MISSING_CLASS = ' border-protest-red-500 focus:ring-protest-red-500';

export function StepFormData({ wizard, profileDeps, highlightMissing = false }: StepFormDataProps) {
  const { formData, updateFormField, canProceedToStep2 } = wizard;
  const { profileLoaded, handleContinue } = useStepFormProfile(wizard, profileDeps);

  const missing = new Set<keyof WizardFormData>(highlightMissing ? missingFormFields(formData) : []);
  const mark = (field: keyof WizardFormData) => (missing.has(field) ? MISSING_CLASS : '');

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
          {highlightMissing && missing.size > 0
            ? 'Completează câmpurile marcate pentru a continua; restul au fost preluate din profil și din conversație.'
            : 'Completează datele necesare pentru formularea cererii.'}
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
              className={`w-full field-input${mark('solicitantName')}`}
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
            className={`w-full field-input${mark('solicitantAddress')}`}
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

        {/* Session name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Denumire sesiune *
          </label>
          <input
            type="text"
            value={formData.sessionName}
            onChange={(e) => updateFormField('sessionName', e.target.value)}
            placeholder="ex: Transparența cheltuielilor publice"
            className={`w-full field-input${mark('sessionName')}`}
          />
        </div>

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
              className={`w-full field-input${mark('institutionName')}`}
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
                (formData.institutionEmail && !isValidInstitutionEmail(formData.institutionEmail)) || missing.has('institutionEmail')
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
