"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="animate-pulse text-urban-gray-400">Se încarcă...</div></div>}>
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
        <div className="bg-white border-2 border-black p-8 shadow-activist-lg">
          <div className="text-center mb-6">
            <Lock className="w-10 h-10 text-civic-blue-500 mx-auto mb-2" />
            <h1 className="text-xl font-activist uppercase text-civic-blue-700">
              Admin Campanii
            </h1>
            <p className="text-sm text-urban-gray-500 mt-1">
              Folosește contul tău de pe implicarecivica.ro
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold mb-1">
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
              <label htmlFor="password" className="block text-sm font-semibold mb-1">
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
              <p className="text-sm text-protest-red-500">{error}</p>
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
