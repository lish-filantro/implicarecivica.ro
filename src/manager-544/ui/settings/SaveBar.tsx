'use client';

import { Save } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

export default function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onSave}
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
  );
}
