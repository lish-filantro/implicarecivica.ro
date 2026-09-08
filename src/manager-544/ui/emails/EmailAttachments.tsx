'use client';

import { Paperclip, Download, FileText } from 'lucide-react';

export interface EmailAttachment {
  name: string;
  type: string;
  size?: number;
  path?: string;
}

function formatSize(size: number): string {
  return size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
}

/**
 * Opens a signed download URL for the attachment. The API returns 404 (JSON
 * error, no `url`) when the file is missing, in which case nothing happens.
 */
async function openAttachment(path: string): Promise<void> {
  try {
    const res = await fetch(`/api/emails/attachments?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    if (data.url) {
      window.open(data.url, '_blank');
    }
  } catch (err) {
    console.error('Failed to download attachment:', err);
  }
}

export default function EmailAttachments({ attachments }: { attachments: EmailAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Atașamente ({attachments.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (!att.path) return;
              openAttachment(att.path);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors
              ${att.path
                ? 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                : 'border-gray-100 dark:border-gray-700 opacity-50 cursor-default'
              }`}
          >
            <FileText className="h-4 w-4 text-civic-blue-500 flex-shrink-0" />
            <span className="truncate max-w-[200px]">{att.name}</span>
            {att.size && <span className="text-xs text-gray-400">{formatSize(att.size)}</span>}
            {att.path && <Download className="h-3.5 w-3.5 text-gray-400" />}
          </button>
        ))}
      </div>
    </div>
  );
}
