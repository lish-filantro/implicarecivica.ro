'use client';

import { useState, useEffect } from 'react';
import { Save, User, Shield, Bell } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProfile, updateProfile } from '@/lib/supabase/profile-queries';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import type { Profile } from '@/lib/types/profile';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [notificationEmail, setNotificationEmail] = useState(true);
  const [notificationDays, setNotificationDays] = useState(3);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    async function load() {
      try {
        const p = await getProfile();
        if (p) {
          setProfile(p);
          setDisplayName(p.display_name || '');
          setNotificationEmail(p.notification_email);
          setNotificationDays(p.notification_deadline_days);
          setTheme(p.theme);
        } else {
          // No profile yet — use defaults from auth
          setDisplayName(user?.email?.split('@')[0] || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile({
        display_name: displayName.trim() || null,
        notification_email: notificationEmail,
        notification_deadline_days: notificationDays,
        theme,
      });
      setProfile(updated);
      setMessage({ type: 'success', text: 'Setarile au fost salvate.' });
    } catch (err) {
      console.error('Failed to save profile:', err);
      setMessage({ type: 'error', text: 'Nu am putut salva setarile. Incearca din nou.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Setari
      </h1>

      {/* Save feedback */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium
                        ${message.type === 'success'
                          ? 'bg-grassroots-green-100 dark:bg-grassroots-green-900/20 text-grassroots-green-700 dark:text-grassroots-green-400 border border-grassroots-green-200 dark:border-grassroots-green-800'
                          : 'bg-protest-red-100 dark:bg-protest-red-900/20 text-protest-red-700 dark:text-protest-red-400 border border-protest-red-200 dark:border-protest-red-800'
                        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Section */}
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
                onChange={(e) => setDisplayName(e.target.value)}
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
                value={user?.email || ''}
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

        {/* Notifications Section */}
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
                onClick={() => setNotificationEmail(!notificationEmail)}
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
                onChange={(e) => setNotificationDays(Number(e.target.value))}
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
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
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

        {/* Security Section */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-protest-red-100 dark:bg-protest-red-900/20">
              <Shield className="h-5 w-5 text-protest-red-600 dark:text-protest-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Securitate</h2>
          </div>

          <div>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400
                         border border-red-200 dark:border-red-800 rounded-lg
                         hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Deconectare
            </button>
          </div>
        </section>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5
                       bg-civic-blue-500 hover:bg-civic-blue-600 text-white font-semibold rounded-lg
                       transition-all duration-200 hover:shadow-lg
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          >
            {saving ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  );
}
