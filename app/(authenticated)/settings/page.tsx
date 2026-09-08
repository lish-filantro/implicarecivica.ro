'use client';

import { useAuth } from '@m544/ui/auth/AuthProvider';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useProfileSettings } from '@m544/ui/settings/useProfileSettings';
import StatusMessage from '@m544/ui/settings/StatusMessage';
import ProfileSection from '@m544/ui/settings/ProfileSection';
import NotificationsSection from '@m544/ui/settings/NotificationsSection';
import SecuritySection from '@m544/ui/settings/SecuritySection';
import SaveBar from '@m544/ui/settings/SaveBar';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { loading, saving, message, form, setField, save } = useProfileSettings(user);

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
      {message && <StatusMessage message={message} className="mb-6" />}

      <div className="space-y-8">
        <ProfileSection
          displayName={form.displayName}
          onDisplayNameChange={(value) => setField('displayName', value)}
          email={user?.email || ''}
        />
        <NotificationsSection form={form} setField={setField} />
        <SecuritySection onSignOut={signOut} />
        <SaveBar saving={saving} onSave={save} />
      </div>
    </div>
  );
}
