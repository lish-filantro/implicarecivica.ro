// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FeedbackForm from '@m544/ui/feedback/FeedbackForm';
import FeedbackHistory from '@m544/ui/feedback/FeedbackHistory';
import type { Feedback } from '@m544/shared/types/feedback';

afterEach(cleanup);

const base = {
  category: null,
  onCategoryChange: () => undefined,
  message: '',
  onMessageChange: () => undefined,
  submitting: false,
  success: false,
  error: null,
  onSubmit: () => undefined,
};

const submitButton = () => screen.getByRole('button', { name: 'Trimite feedback' }) as HTMLButtonElement;

describe('FeedbackForm', () => {
  it('disables submit until both category and message are set', () => {
    render(h(FeedbackForm, base));
    expect(submitButton().disabled).toBe(true);
    cleanup();

    render(h(FeedbackForm, { ...base, category: 'bug' }));
    expect(submitButton().disabled).toBe(true);
    cleanup();

    render(h(FeedbackForm, { ...base, message: 'ceva' }));
    expect(submitButton().disabled).toBe(true);
    cleanup();

    render(h(FeedbackForm, { ...base, category: 'bug', message: 'ceva' }));
    expect(submitButton().disabled).toBe(false);
  });

  it('renders the four category pills and forwards clicks', () => {
    const onCategoryChange = vi.fn();
    render(h(FeedbackForm, { ...base, onCategoryChange }));
    for (const label of ['Bug', 'Sugestie', 'Dificultate', 'Altele']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Dificultate' }));
    expect(onCategoryChange).toHaveBeenCalledWith('utilizare');
  });

  it('forwards message edits and submit, shows error/success/submitting states', () => {
    const onMessageChange = vi.fn();
    const onSubmit = vi.fn();
    render(h(FeedbackForm, { ...base, category: 'bug', message: 'x', onMessageChange, onSubmit }));
    fireEvent.change(screen.getByPlaceholderText('Descrie problema, sugestia sau dificultatea...'), {
      target: { value: 'nou' },
    });
    expect(onMessageChange).toHaveBeenCalledWith('nou');
    fireEvent.click(submitButton());
    expect(onSubmit).toHaveBeenCalled();
    cleanup();

    render(h(FeedbackForm, { ...base, error: 'Eroare X' }));
    expect(screen.getByText('Eroare X')).toBeTruthy();
    cleanup();

    render(h(FeedbackForm, { ...base, success: true }));
    expect(screen.getByText('Mulțumim! Feedbackul tău a fost înregistrat.')).toBeTruthy();
    cleanup();

    render(h(FeedbackForm, { ...base, category: 'bug', message: 'x', submitting: true }));
    expect((screen.getByRole('button', { name: 'Se trimite...' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('FeedbackHistory', () => {
  const item: Feedback = {
    id: 'f1',
    user_id: 'u1',
    category: 'sugestie',
    message: 'Export CSV',
    page_url: '/dashboard',
    status: 'in_lucru',
    created_at: new Date().toISOString(),
  };

  it('renders items with category and status badges', () => {
    render(h(FeedbackHistory, { feedback: [item], loading: false }));
    expect(screen.getByText('Sugestie')).toBeTruthy();
    expect(screen.getByText('În lucru')).toBeTruthy();
    expect(screen.getByText('Export CSV')).toBeTruthy();
    expect(screen.getByText('Pagina: /dashboard')).toBeTruthy();
  });

  it('renders the empty state', () => {
    render(h(FeedbackHistory, { feedback: [], loading: false }));
    expect(screen.getByText('Nu ai trimis încă niciun feedback.')).toBeTruthy();
  });

  it('renders skeletons while loading', () => {
    const { container } = render(h(FeedbackHistory, { feedback: [], loading: true }));
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });
});
