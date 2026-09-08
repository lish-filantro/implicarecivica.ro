'use client';

import { Bell } from 'lucide-react';
import type { SettingsForm } from './useProfileSettings';

interface NotificationsSectionProps {
  form: SettingsForm;
  setField: <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void;
}

export default function NotificationsSection({ form, setField }: NotificationsSectionProps) {
  const { notificationEmail, notificationDays, theme } = form;
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-activist-orange-50 dark:bg-activist-orange-900/20">
          <Bell className="h-5 w-5 text-activist-orange-600 dark:text-activist-orange-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notificari</h2>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Notificari pe email
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Primeste alerte cand termenele se apropie
            </p>
          </div>
          <button
            onClick={() => setField('notificationEmail', !notificationEmail)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50
                       ${notificationEmail
                         ? 'bg-civic-blue-500'
                         : 'bg-gray-300 dark:bg-gray-600'
                       }`}
          >
            <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow
                              transition-transform duration-200
                              ${notificationEmail ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Avertizare termen (zile inainte)
          </label>
          <select
            value={notificationDays}
            onChange={(e) => setField('notificationDays', Number(e.target.value))}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          >
            <option value={1}>1 zi</option>
            <option value={2}>2 zile</option>
            <option value={3}>3 zile</option>
            <option value={5}>5 zile</option>
            <option value={7}>7 zile</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tema
          </label>
          <select
            value={theme}
            onChange={(e) => setField('theme', e.target.value as SettingsForm['theme'])}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          >
            <option value="system">Sistem</option>
            <option value="light">Deschis</option>
            <option value="dark">Inchis</option>
          </select>
        </div>
      </div>
    </section>
  );
}
