"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email sau parolă incorectă");
      setLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirectedFrom") || "/campanii/admin";
    router.replace(redirectTo);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-md">
          <div className="text-center mb-6">
            <div className="p-3 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/20 inline-block mb-3">
              <Lock className="w-8 h-8 text-civic-blue-500 dark:text-civic-blue-400" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Admin Campanii
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Folosește contul tău de pe implicarecivica.ro
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-modern"
                autoFocus
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Parolă
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-modern"
                required
              />
            </div>

            {error && (
              <div className="bg-protest-red-100 dark:bg-protest-red-900/20 border border-protest-red-200 dark:border-protest-red-800 rounded-lg p-3 text-sm text-protest-red-700 dark:text-protest-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-activist w-full disabled:opacity-50"
            >
              {loading ? "Se verifică..." : "Intră"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
