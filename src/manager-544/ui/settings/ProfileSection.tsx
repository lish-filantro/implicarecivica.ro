'use client';

import { User } from 'lucide-react';

interface ProfileSectionProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  email: string;
}

export default function ProfileSection({ displayName, onDisplayNameChange, email }: ProfileSectionProps) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/20">
          <User className="h-5 w-5 text-civic-blue-600 dark:text-civic-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profil</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nume afisat
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Numele tau"
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400
                       cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Emailul nu poate fi schimbat.
          </p>
        </div>
      </div>
    </section>
  );
}
