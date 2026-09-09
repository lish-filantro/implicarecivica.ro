// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstitutionCard, { NO_EMAIL_HINT, LOW_CONFIDENCE_HINT } from '@m544/ui/chat/InstitutionCard';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { HANDOFF } from './_fakes';

function renderCard(handoff: ConversationHandoff = HANDOFF, busy = false) {
  const props = { onPrepare: vi.fn(), onReject: vi.fn(), onManualEntry: vi.fn() };
  render(<InstitutionCard handoff={handoff} busy={busy} {...props} />);
  return props;
}

const prepare = () => screen.getByRole('button', { name: 'Pregătește cererile' }) as HTMLButtonElement;

describe('InstitutionCard', () => {
  it('shows name, email, source host and hands off on the primary button', () => {
    const props = renderCard();
    const card = screen.getByRole('region', { name: 'Instituție identificată' });
    expect(card.textContent).toContain('Primăria Municipiului Pitești');
    expect(card.textContent).toContain('primaria@primariapitesti.ro');
    expect(screen.getByText('primariapitesti.ro').closest('a')?.getAttribute('href')).toBe('https://www.primariapitesti.ro');
    expect(prepare().disabled).toBe(false);
    expect(screen.queryByText(NO_EMAIL_HINT)).toBeNull();
    expect(screen.queryByText((_, el) => el?.textContent?.includes(LOW_CONFIDENCE_HINT) ?? false)).toBeNull();

    fireEvent.click(prepare());
    expect(props.onPrepare).toHaveBeenCalledTimes(1);
  });

  it('without an email the primary button is disabled and the hint explains what to do', () => {
    renderCard({ ...HANDOFF, institutionEmail: null, emailConfidence: null, sourceUrl: null });
    expect(prepare().disabled).toBe(true);
    expect(screen.getByText(NO_EMAIL_HINT)).toBeTruthy();
    expect(screen.getByText('negăsit')).toBeTruthy();
  });

  it('low confidence keeps the button enabled but warns', () => {
    renderCard({ ...HANDOFF, emailConfidence: 'low' });
    expect(prepare().disabled).toBe(false);
    expect(screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent?.includes(LOW_CONFIDENCE_HINT) ?? false))).toBeTruthy();
  });

  it('busy disables the button and shows progress', () => {
    renderCard(HANDOFF, true);
    const btn = screen.getByRole('button', { name: 'Se pregătește…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('once confirmed it shows the badge and lets the user reopen the wizard', () => {
    const props = renderCard({ ...HANDOFF, confirmedAt: '2026-09-09T10:05:00.000Z' });
    expect(screen.getByText('Confirmată')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Deschide cererile' }));
    expect(props.onPrepare).toHaveBeenCalledTimes(1);
  });

  it('once a session exists it links to the dashboard and to adding requests', () => {
    renderCard({ ...HANDOFF, confirmedAt: '2026-09-09T10:05:00.000Z', sessionId: 's1' });
    expect(screen.getByText('Sesiune creată')).toBeTruthy();
    expect(screen.getByText('Vezi în dashboard').getAttribute('href')).toBe('/dashboard');
    expect(screen.getByText('Cereri noi').getAttribute('href')).toBe('/requests/add?session=s1');
    expect(screen.queryByRole('button', { name: 'Pregătește cererile' })).toBeNull();
    expect(screen.queryByText('Nu e instituția corectă')).toBeNull();
  });

  it('"Nu e instituția corectă" reveals search-again / manual entry / back', () => {
    const props = renderCard();
    fireEvent.click(screen.getByText('Nu e instituția corectă'));
    expect(screen.getByText('Ce dorești să faci?')).toBeTruthy();

    fireEvent.click(screen.getByText('Înapoi'));
    expect(screen.queryByText('Ce dorești să faci?')).toBeNull();

    fireEvent.click(screen.getByText('Nu e instituția corectă'));
    fireEvent.click(screen.getByText('Introducere manuală'));
    expect(props.onManualEntry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Caută din nou'));
    expect(props.onReject).toHaveBeenCalledTimes(1);
    // back to the primary state after asking again
    expect(prepare()).toBeTruthy();
  });
});
