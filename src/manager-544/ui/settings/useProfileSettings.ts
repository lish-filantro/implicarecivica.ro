'use client';

import { useState, useEffect, useCallback } from 'react';
import { getProfile, updateProfile } from '@m544/emails/profile-queries.client';
import type { Profile, ProfileUpdate } from '@m544/shared/types/profile';

export type StatusMessageData = { type: 'success' | 'error'; text: string };

export interface SettingsForm {
  displayName: string;
  notificationEmail: boolean;
  notificationDays: number;
  theme: 'light' | 'dark' | 'system';
}

export interface ProfileSettingsDeps {
  getProfile: () => Promise<Profile | null>;
  updateProfile: (updates: ProfileUpdate) => Promise<Profile>;
}

const DEFAULT_DEPS: ProfileSettingsDeps = {
  getProfile: () => getProfile(),
  updateProfile: (updates) => updateProfile(updates),
};

/** Load + save of the settings form (moved 1:1 from the settings page). */
export function useProfileSettings(user: { email?: string } | null | undefined, deps: ProfileSettingsDeps = DEFAULT_DEPS) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessageData | null>(null);
  const [form, setForm] = useState<SettingsForm>({
    displayName: '',
    notificationEmail: true,
    notificationDays: 3,
    theme: 'system',
  });

  useEffect(() => {
    async function load() {
      try {
        const p = await deps.getProfile();
        if (p) {
          setProfile(p);
          setForm({
            displayName: p.display_name || '',
            notificationEmail: p.notification_email,
            notificationDays: p.notification_deadline_days,
            theme: p.theme,
          });
        } else {
          // No profile yet — use defaults from auth
          setForm((prev) => ({ ...prev, displayName: user?.email?.split('@')[0] || '' }));
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = useCallback(<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await deps.updateProfile({
        display_name: form.displayName.trim() || null,
        notification_email: form.notificationEmail,
        notification_deadline_days: form.notificationDays,
        theme: form.theme,
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
  }, [deps, form]);

  return { profile, loading, saving, message, form, setField, save };
}
