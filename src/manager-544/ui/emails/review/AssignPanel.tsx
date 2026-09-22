'use client';

/**
 * „Atribuie emailul unei întrebări" — one move says both *which* question the
 * email belongs to and *what it does* to it, because the two are useless apart:
 * linking an email while keeping a wrong category carries the mistake into the
 * request's status and deadlines.
 *
 * The session select is only a suggestion based on the sender: an institution
 * answering from an unexpected mailbox is exactly the case that ends up here.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listAssignableRequests, type AssignableRequest } from '@m544/requests/queries.client';
import { ASSIGNABLE_CATEGORIES } from '@m544/emails/review/analysis-from-email';
import type { Email } from '@m544/shared/types/email';
import type { EmailCategory } from '@m544/shared/types/request';
import { CATEGORY_DETAIL_LABELS } from '../badges';
import { groupBySession, questionLabel, guessSessionKey } from './assignable';
import type { ReviewApi } from './useReview';

export type LoadAssignableRequests = () => Promise<AssignableRequest[]>;

interface AssignPanelProps {
  email: Email;
  review: ReviewApi;
  loadRequests?: LoadAssignableRequests;
}

export const REVIEW_BANNER = 'Necesită revizuire: nu am putut asocia acest email cu certitudine unei cereri.';
export const NO_REQUESTS = 'Nu ai nicio cerere la care să atribui emailul.';
const LOAD_ERROR = 'Nu am putut încărca cererile.';
/** Empty category = leave the classifier's analysis as it is. */
const KEEP_CATEGORY = 'Lasă clasificarea automată';

const isAssignable = (c: EmailCategory | null | undefined): boolean =>
  Boolean(c && ASSIGNABLE_CATEGORIES.includes(c));

const SELECT_CLASS =
  'flex-1 min-w-0 text-sm rounded-md border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5';

export default function AssignPanel({ email, review, loadRequests = () => listAssignableRequests() }: AssignPanelProps) {
  const [requests, setRequests] = useState<AssignableRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState('');
  const [requestId, setRequestId] = useState('');
  const [category, setCategory] = useState<EmailCategory | ''>(isAssignable(email.category) ? email.category! : '');

  useEffect(() => {
    let alive = true;
    loadRequests()
      .then((rows) => alive && setRequests(rows))
      .catch((err) => {
        console.error('Failed to load assignable requests:', err);
        if (alive) setLoadError(LOAD_ERROR);
      });
    return () => {
      alive = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupBySession(requests ?? []), [requests]);

  // Both selects are derived, not synchronised through effects: until the user
  // touches them they follow the loaded data (suggested session, its first
  // question), so there is never a render where the panel shows a stale pair.
  const group =
    groups.find((g) => g.key === sessionKey) ??
    groups.find((g) => g.key === guessSessionKey(groups, email.from_email)) ??
    groups[0];
  const questions = group?.requests ?? [];
  const selectedId = questions.some((r) => r.id === requestId) ? requestId : (questions[0]?.id ?? '');

  const error = review.error ?? loadError;
  const flagged = email.needs_review === true;

  return (
    <div
      role="region"
      aria-label="Atribuire manuală"
      className={`mx-6 mt-4 rounded-lg border p-4 ${
        flagged
          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
      }`}
    >
      {flagged && (
        <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{REVIEW_BANNER}</p>
        </div>
      )}

      {groups.length === 0 ? (
        requests && !loadError && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{NO_REQUESTS}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label htmlFor={`assign-session-${email.id}`} className="sm:w-28 text-xs text-gray-600 dark:text-gray-400">
              Sesiunea
            </label>
            <select
              id={`assign-session-${email.id}`}
              value={group?.key ?? ''}
              onChange={(e) => {
                setSessionKey(e.target.value);
                setRequestId('');
              }}
              disabled={review.busy}
              className={SELECT_CLASS}
            >
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label htmlFor={`assign-question-${email.id}`} className="sm:w-28 text-xs text-gray-600 dark:text-gray-400">
              Întrebarea
            </label>
            <select
              id={`assign-question-${email.id}`}
              value={selectedId}
              onChange={(e) => setRequestId(e.target.value)}
              disabled={review.busy}
              className={SELECT_CLASS}
            >
              {questions.map((r) => (
                <option key={r.id} value={r.id}>
                  {questionLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label htmlFor={`assign-category-${email.id}`} className="sm:w-28 text-xs text-gray-600 dark:text-gray-400">
              Emailul este
            </label>
            <select
              id={`assign-category-${email.id}`}
              value={category}
              onChange={(e) => setCategory(e.target.value as EmailCategory | '')}
              disabled={review.busy}
              className={SELECT_CLASS}
            >
              <option value="">{KEEP_CATEGORY}</option>
              {ASSIGNABLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_DETAIL_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!selectedId || review.busy}
          onClick={() => review.assign(email.id, selectedId, category || undefined)}
        >
          <Link2 className="h-4 w-4" />
          Atribuie
        </Button>
        {flagged && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={review.busy} onClick={() => review.dismiss(email.id)}>
            <Check className="h-4 w-4" />
            Marchează ca revizuit
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-protest-red-600 dark:text-protest-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
