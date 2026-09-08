import type { StatusMessageData } from './useProfileSettings';

/** Green/red inline feedback banner used for save and password results. */
export default function StatusMessage({ message, className = '' }: { message: StatusMessageData; className?: string }) {
  return (
    <div className={`${className} px-4 py-3 rounded-lg text-sm font-medium
                    ${message.type === 'success'
                      ? 'bg-grassroots-green-100 dark:bg-grassroots-green-900/20 text-grassroots-green-700 dark:text-grassroots-green-400 border border-grassroots-green-200 dark:border-grassroots-green-800'
                      : 'bg-protest-red-100 dark:bg-protest-red-900/20 text-protest-red-700 dark:text-protest-red-400 border border-protest-red-200 dark:border-protest-red-800'
                    }`}>
      {message.text}
    </div>
  );
}
