'use client';

import React from 'react';
import { Pencil } from 'lucide-react';
import type { WizardFormData } from './types';

interface WizardSummaryCardProps {
  formData: WizardFormData;
  /** Opens step 1 to edit; the selected questions are kept. */
  onEdit: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm min-w-0">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd className="text-gray-800 dark:text-gray-200 break-words">
        {value.trim() || <span className="italic text-protest-red-600 dark:text-protest-red-400">necompletat</span>}
      </dd>
    </div>
  );
}

/** Compact recap of step 1 shown above the questions when the wizard started at step 2. */
export function WizardSummaryCard({ formData, onEdit }: WizardSummaryCardProps) {
  return (
    <section
      aria-label="Rezumat cerere"
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Date cerere</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Preluate din profil și din conversație</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-civic-blue-700 dark:text-civic-blue-300 bg-civic-blue-50 dark:bg-civic-blue-900/20 hover:bg-civic-blue-100 dark:hover:bg-civic-blue-900/30 rounded-lg transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifică
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <dl className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Solicitant</p>
          <Field label="Nume:" value={formData.solicitantName} />
          <Field label="Email:" value={formData.solicitantEmail} />
          <Field label="Adresă:" value={formData.solicitantAddress} />
        </dl>
        <dl className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Instituție</p>
          <Field label="Nume:" value={formData.institutionName} />
          <Field label="Email:" value={formData.institutionEmail} />
          <Field label="Sesiune:" value={formData.sessionName} />
        </dl>
      </div>
    </section>
  );
}
