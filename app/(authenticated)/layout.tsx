'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { TopNavbar } from '@/components/navigation/TopNavbar';
import { LoadingSpinner } from '@/components/shared/loading-spinner';


export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Middleware handles redirect, but guard as fallback
  if (!user) return null;

  return (
    <>
      <TopNavbar />
      <main className="pt-14 min-h-screen bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </>
  );
}
