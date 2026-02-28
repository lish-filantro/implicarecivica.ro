import { Mail } from 'lucide-react';

export default function EmailsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 rounded-full bg-civic-blue-50 dark:bg-civic-blue-900/20 mb-6">
        <Mail className="h-12 w-12 text-civic-blue-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Emailuri
      </h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md">
        Gestionarea emailurilor trimise si primite va fi disponibila in curand.
      </p>
      <span className="mt-4 px-3 py-1 text-xs font-medium rounded-full
                       bg-activist-orange-100 text-activist-orange-700
                       dark:bg-activist-orange-900/30 dark:text-activist-orange-400">
        In dezvoltare
      </span>
    </div>
  );
}
