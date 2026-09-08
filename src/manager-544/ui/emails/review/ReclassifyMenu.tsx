'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Email } from '@m544/shared/types/email';
import type { EmailCategory } from '@m544/shared/types/request';
import { CATEGORY_DETAIL_LABELS } from '../badges';
import type { ReviewApi } from './useReview';

/** The categories the classifier can produce for a received email ('trimise' is outgoing only). */
export const CLASSIFIER_CATEGORIES: readonly EmailCategory[] = [
  'inregistrate',
  'amanate',
  'raspunse',
  'intarziate',
  'redirectionat',
  'irelevant',
];

export function reclassifyChoices(current: EmailCategory | null | undefined): EmailCategory[] {
  return CLASSIFIER_CATEGORIES.filter((c) => c !== current);
}

interface ReclassifyMenuProps {
  email: Email;
  review: ReviewApi;
}

/** "Clasificarea e greșită" → pick the right category (+ optional note) → POST reclassify. */
export default function ReclassifyMenu({ email, review }: ReclassifyMenuProps) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<EmailCategory | null>(null);
  const [note, setNote] = useState('');

  const submit = async () => {
    if (!choice) return;
    const updated = await review.reclassify(email.id, choice, note);
    if (updated) {
      setOpen(false);
      setChoice(null);
      setNote('');
    }
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 text-gray-600 dark:text-gray-300" onClick={() => setOpen(true)}>
        <Flag className="h-4 w-4" />
        Clasificarea e greșită
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Corectează clasificarea" className="flex flex-col gap-2 w-full">
      <p className="text-xs text-gray-500 dark:text-gray-400">Ce este, de fapt, acest email?</p>
      <div className="flex flex-wrap gap-1.5">
        {reclassifyChoices(email.category).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choice === c}
            onClick={() => setChoice(c)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
              ${choice === c
                ? 'bg-civic-blue-600 border-civic-blue-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            {CATEGORY_DETAIL_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          aria-label="Notă (opțional)"
          placeholder="Notă (opțional)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 text-sm rounded-md border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5"
        />
        <Button size="sm" disabled={!choice || review.busy} onClick={submit}>
          Trimite corecția
        </Button>
        <Button size="sm" variant="ghost" disabled={review.busy} onClick={() => setOpen(false)}>
          Renunță
        </Button>
      </div>
      {review.error && (
        <p role="alert" className="text-xs text-protest-red-600 dark:text-protest-red-400">
          {review.error}
        </p>
      )}
    </div>
  );
}
