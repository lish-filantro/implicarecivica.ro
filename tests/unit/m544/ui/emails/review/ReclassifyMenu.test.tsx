// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ReclassifyMenu, { reclassifyChoices, CLASSIFIER_CATEGORIES } from '@m544/ui/emails/review/ReclassifyMenu';
import type { ReviewApi } from '@m544/ui/emails/review/useReview';
import { makeEmail } from '../_fixtures';

afterEach(cleanup);

function api(over: Partial<ReviewApi> = {}): ReviewApi {
  return {
    assign: vi.fn(async () => null),
    reclassify: vi.fn(async () => null),
    dismiss: vi.fn(async () => null),
    busy: false,
    error: null,
    ...over,
  };
}

describe('ReclassifyMenu', () => {
  it('opens on "Clasificarea e greșită", lists the other 5 categories, sends the pick with the note', async () => {
    const updated = makeEmail({ id: 'e1', category: 'amanate' });
    const review = api({ reclassify: vi.fn(async () => updated) });
    render(<ReclassifyMenu email={makeEmail({ id: 'e1', category: 'raspunse' })} review={review} />);

    expect(screen.queryByText('Cerere de prelungire')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clasificarea e greșită' }));

    for (const label of ['Confirmare înregistrare', 'Cerere de prelungire', 'Răspuns întârziat', 'Redirecționat', 'Irelevant']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Răspuns final' })).toBeNull();

    const send = screen.getByRole('button', { name: 'Trimite corecția' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cerere de prelungire' }));
    expect(send.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Notă (opțional)'), { target: { value: 'scrie clar 30 zile' } });
    fireEvent.click(send);

    expect(review.reclassify).toHaveBeenCalledWith('e1', 'amanate', 'scrie clar 30 zile');
    // closes again after success
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clasificarea e greșită' })).toBeTruthy());
  });

  it('stays open and shows the error when the call fails; "Renunță" closes it', async () => {
    const review = api({ error: 'Eroare la revizuire' });
    render(<ReclassifyMenu email={makeEmail({ category: 'inregistrate' })} review={review} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clasificarea e greșită' }));
    fireEvent.click(screen.getByRole('button', { name: 'Irelevant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trimite corecția' }));
    await waitFor(() => expect(review.reclassify).toHaveBeenCalled());
    expect(screen.getByRole('alert').textContent).toBe('Eroare la revizuire');
    expect(screen.getByRole('group', { name: 'Corectează clasificarea' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Renunță' }));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('reclassifyChoices excludes the current category (all 6 when there is none)', () => {
    expect(reclassifyChoices('irelevant')).toEqual(['inregistrate', 'amanate', 'raspunse', 'intarziate', 'redirectionat']);
    expect(reclassifyChoices(null)).toEqual([...CLASSIFIER_CATEGORIES]);
    expect(CLASSIFIER_CATEGORIES).not.toContain('trimise');
  });
});
