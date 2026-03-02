"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { TopNavbar } from "@/components/navigation/TopNavbar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user) {
    return (
      <>
        <TopNavbar />
        <main className="pt-14 min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </>
    );
  }

  // Unauthenticated (login page) — render without navbar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
}
