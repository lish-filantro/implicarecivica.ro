'use client';

import { useState, useCallback } from 'react';
import { createBrowserClient } from '@m544/shared/db/browser-client';
import type { StatusMessageData } from './useProfileSettings';

export type UpdatePassword = (password: string) => Promise<{ error: { message: string } | null }>;

export const updatePasswordWithSupabase: UpdatePassword = async (password) => {
  const { error } = await createBrowserClient().auth.updateUser({ password });
  return { error };
};

/** Password change form state + validation (moved 1:1 from the settings page). */
export function usePasswordChange(updatePassword: UpdatePassword = updatePasswordWithSupabase) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessageData | null>(null);

  const submit = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Parolele nu coincid.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Parola trebuie să aibă cel puțin 6 caractere.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        setMessage({
          type: 'error',
          text:
            error.message === 'New password should be different from the old password.'
              ? 'Parola nouă trebuie să fie diferită de cea veche.'
              : error.message,
        });
      } else {
        setMessage({ type: 'success', text: 'Parola a fost schimbată cu succes.' });
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Nu am putut schimba parola. Încearcă din nou.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }, [newPassword, confirmPassword, updatePassword]);

  return { newPassword, setNewPassword, confirmPassword, setConfirmPassword, saving, message, submit };
}
