'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listOpenRequests, type OpenRequestOption } from '@m544/requests/queries.client';
import type { Email } from '@m544/shared/types/email';
import type { ReviewApi } from './useReview';

export type LoadOpenRequests = () => Promise<OpenRequestOption[]>;

interface ReviewPanelProps {
  email: Email;
  review: ReviewApi;
  loadOpenRequests?: LoadOpenRequests;
}

export const REVIEW_BANNER = 'Necesită revizuire: nu am putut asocia acest email cu certitudine unei cereri.';

export function requestLabel(r: OpenRequestOption): string {
  const reg = r.registration_number ? ` (nr. ${r.registration_number})` : '';
  return `${r.institution_name} — ${r.subject}${reg}`;
}

/** Banner + "assign to request" select shown on emails flagged needs_review. */
export default function ReviewPanel({ email, review, loadOpenRequests = () => listOpenRequests() }: ReviewPanelProps) {
  const [options, setOptions] = useState<OpenRequestOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    let alive = true;
    loadOpenRequests()
      .then((rows) => alive && setOptions(rows))
      .catch((err) => {
        console.error('Failed to load open requests:', err);
        if (alive) setLoadError('Nu am putut încărca cererile deschise.');
      });
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const error = review.error ?? loadError;

  return (
    <div
      role="region"
      aria-label="Revizuire manuală"
      className="mx-6 mt-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4"
    >
      <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>{REVIEW_BANNER}</p>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <label htmlFor={`review-request-${email.id}`} className="sr-only">
          Cererea
        </label>
        <select
          id={`review-request-${email.id}`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={review.busy}
          className="flex-1 min-w-0 text-sm rounded-md border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5"
        >
          <option value="">{options.length ? 'Alege cererea...' : 'Nu ai cereri deschise'}</option>
          {options.map((r) => (
            <option key={r.id} value={r.id}>
              {requestLabel(r)}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!selected || review.busy}
          onClick={() => review.assign(email.id, selected)}
        >
          <Link2 className="h-4 w-4" />
          Asociază
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={review.busy} onClick={() => review.dismiss(email.id)}>
          <Check className="h-4 w-4" />
          Marchează ca revizuit
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-protest-red-600 dark:text-protest-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
