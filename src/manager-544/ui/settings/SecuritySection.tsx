'use client';

import { Shield } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { usePasswordChange, type UpdatePassword } from './usePasswordChange';
import StatusMessage from './StatusMessage';

interface SecuritySectionProps {
  onSignOut: () => void;
  updatePassword?: UpdatePassword;
}

export default function SecuritySection({ onSignOut, updatePassword }: SecuritySectionProps) {
  const pw = usePasswordChange(updatePassword);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-protest-red-100 dark:bg-protest-red-900/20">
          <Shield className="h-5 w-5 text-protest-red-600 dark:text-protest-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Securitate</h2>
      </div>

      <div className="space-y-6">
        {/* Change password */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Schimbă parola
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parolă nouă
            </label>
            <input
              type="password"
              value={pw.newPassword}
              onChange={(e) => pw.setNewPassword(e.target.value)}
              placeholder="Minim 6 caractere"
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmă parola nouă
            </label>
            <input
              type="password"
              value={pw.confirmPassword}
              onChange={(e) => pw.setConfirmPassword(e.target.value)}
              placeholder="Repetă parola nouă"
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
            />
          </div>

          {pw.message && <StatusMessage message={pw.message} />}

          <button
            onClick={pw.submit}
            disabled={pw.saving || !pw.newPassword || !pw.confirmPassword}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       bg-civic-blue-500 hover:bg-civic-blue-600 text-white rounded-lg
                       transition-colors duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          >
            {pw.saving ? <LoadingSpinner size="sm" /> : null}
            {pw.saving ? 'Se salvează...' : 'Schimbă parola'}
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Sign out */}
        <div>
          <button
            onClick={onSignOut}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400
                       border border-red-200 dark:border-red-800 rounded-lg
                       hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Deconectare
          </button>
        </div>
      </div>
    </section>
  );
}
