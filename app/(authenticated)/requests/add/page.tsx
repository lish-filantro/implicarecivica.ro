'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Shield } from 'lucide-react';
import { useRequestWizard } from '@/lib/hooks/useRequestWizard';
import { CATEGORIES } from '@/lib/hooks/useRequestWizard';
import { QuestionCategory } from '@/components/requests/QuestionCategory';
import { StickyActionBar } from '@/components/requests/StickyActionBar';
import { PreviewModal } from '@/components/requests/PreviewModal';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { getSessionWithRequests } from '@/lib/supabase/session-queries';
import { getProfile } from '@/lib/supabase/profile-queries';
import type { RequestSessionWithRequests } from '@/lib/types/session';

interface RateLimitInfo {
  sent_today: number;
  remaining: number;
  limit: number;
}

function AddRequestsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const [session, setSession] = useState<RequestSessionWithRequests | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  const wizard = useRequestWizard();

  // Load session data and profile
  useEffect(() => {
    if (!sessionId) {
      setError('Sesiune nespecificată');
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const [sessionData, profile] = await Promise.all([
          getSessionWithRequests(sessionId!),
          getProfile(),
        ]);

        if (!sessionData) {
          setError('Sesiunea nu a fost găsită');
          return;
        }

        setSession(sessionData);

        // Pre-fill wizard with session data
        if (profile) {
          wizard.initFormFromProfile(profile);
        }
        wizard.updateFormField('institutionName', sessionData.institution_name);
        wizard.updateFormField('institutionEmail', sessionData.institution_email || '');
        wizard.updateFormField('sessionName', sessionData.name || sessionData.subject);

        // Fetch rate limit
        if (sessionData.institution_email) {
          try {
            const res = await fetch(`/api/rate-limit/check?email=${encodeURIComponent(sessionData.institution_email)}`);
            if (res.ok) {
              setRateLimit(await res.json());
            }
          } catch {
            // silently fail
          }
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        setError('Eroare la încărcarea sesiunii');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const showPreview = wizard.currentStep === 3;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-protest-red-600 dark:text-protest-red-400">{error || 'Sesiune negăsită'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-sm text-civic-blue-600 dark:text-civic-blue-400 hover:underline"
        >
          Înapoi la dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi la dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Trimite alte cereri
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Adaugă întrebări noi la sesiunea existentă
        </p>
      </div>

      {/* Session info card (read-only) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/20">
            <Building2 className="h-4 w-4 text-civic-blue-600 dark:text-civic-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {session.institution_name}
            </p>
            {session.institution_email && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3 w-3 text-gray-400" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {session.institution_email}
                </p>
              </div>
            )}
          </div>
        </div>

        {session.name && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sesiune: {session.name}
          </p>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {session.total_requests} cereri trimise anterior
        </p>
      </div>

      {/* Rate limit info */}
      {rateLimit !== null && (
        <div className={`flex items-start gap-3 p-3 rounded-lg border mb-6 ${
          rateLimit.remaining === 0
            ? 'bg-protest-red-50 dark:bg-protest-red-900/10 border-protest-red-200 dark:border-protest-red-800/30'
            : 'bg-civic-blue-50 dark:bg-civic-blue-900/10 border-civic-blue-200 dark:border-civic-blue-800/30'
        }`}>
          <Shield className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
            rateLimit.remaining === 0
              ? 'text-protest-red-600 dark:text-protest-red-400'
              : 'text-civic-blue-600 dark:text-civic-blue-400'
          }`} />
          <p className={`text-xs ${
            rateLimit.remaining === 0
              ? 'text-protest-red-800 dark:text-protest-red-300'
              : 'text-civic-blue-800 dark:text-civic-blue-300'
          }`}>
            Limita zilnică: <strong>{rateLimit.limit} cereri</strong> per instituție.
            {rateLimit.sent_today > 0 && (
              <> Azi ai trimis <strong>{rateLimit.sent_today}</strong>.</>
            )}
            {' '}Mai poți trimite <strong>{rateLimit.remaining}</strong>.
            {rateLimit.remaining === 0 && ' Încearcă din nou mâine.'}
          </p>
        </div>
      )}

      {/* Questions — direct step 2 */}
      {rateLimit === null || rateLimit.remaining > 0 ? (
        <div className="space-y-6 pb-24">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Adaugă întrebări noi
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Adaugă întrebările pe care dorești să le trimiți instituției.
            </p>
          </div>

          <div className="space-y-3">
            {CATEGORIES.map(cat => (
              <QuestionCategory
                key={cat.id}
                category={cat}
                questions={wizard.questions[cat.id]}
                selectedIds={wizard.selectedQuestionIds}
                selectedCount={wizard.selectedCountByCategory[cat.id]}
                isLoading={false}
                onToggle={wizard.toggleQuestion}
                onSelectAll={() => wizard.selectAllInCategory(cat.id)}
                onDeselectAll={() => wizard.deselectAllInCategory(cat.id)}
                onEdit={wizard.editQuestion}
                onAddCustom={(text) => wizard.addCustomQuestion(cat.id, text)}
                onRemove={wizard.removeQuestion}
              />
            ))}
          </div>

          <StickyActionBar
            selectedCount={wizard.selectedCount}
            onBack={() => router.push('/dashboard')}
            onPreview={() => wizard.setStep(3)}
            isDisabled={!wizard.canProceedToStep3 || (rateLimit !== null && wizard.selectedCount > rateLimit.remaining)}
            dailyLimitInfo={rateLimit ? { remaining: rateLimit.remaining } : undefined}
          />
        </div>
      ) : null}

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          wizard={wizard}
          onClose={() => wizard.setStep(2)}
          existingSessionId={session.id}
        />
      )}
    </div>
  );
}

export default function AddRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <AddRequestsContent />
    </Suspense>
  );
}
