// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuestionCategory } from '@m544/ui/requests/questions/QuestionCategory';
import { QuestionCategoryList } from '@m544/ui/requests/questions/QuestionCategoryList';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { CATEGORIES } from '@m544/ui/requests/wizard/types';
import type { QuestionItem } from '@m544/ui/requests/wizard/types';
import { renderHook, act } from '@testing-library/react';

const CAT = CATEGORIES[0];
const QUESTIONS: QuestionItem[] = [
  { id: 'q1', category: 'A_FINANCIAR', text: 'Prima întrebare', isCustom: false, isEdited: false },
  { id: 'q2', category: 'A_FINANCIAR', text: 'A doua întrebare', isCustom: true, isEdited: false },
];

function renderCategory(overrides: Partial<Parameters<typeof QuestionCategory>[0]> = {}) {
  const props = {
    category: CAT,
    questions: QUESTIONS,
    selectedIds: new Set(['q1']),
    selectedCount: 1,
    isLoading: false,
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onEdit: vi.fn(),
    onAddCustom: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(createElement(QuestionCategory, props));
  return props;
}

afterEach(cleanup);

describe('QuestionCategory', () => {
  it('is collapsed by default and shows the selected/total badge', () => {
    renderCategory();
    expect(screen.getByText('A. Financiar')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
    expect(screen.queryByText('Prima întrebare')).toBeNull();
  });

  it('expands on header click and lists the questions', () => {
    renderCategory();
    fireEvent.click(screen.getByText('A. Financiar'));
    expect(screen.getByText('Prima întrebare')).toBeTruthy();
    expect(screen.getByText('A doua întrebare')).toBeTruthy();
    expect(screen.getByText('Adaugă întrebare')).toBeTruthy();
  });

  it('"Selectează toate" calls onSelectAll when not everything is selected', () => {
    const props = renderCategory();
    fireEvent.click(screen.getByText('A. Financiar'));
    fireEvent.click(screen.getByText('Selectează toate'));
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
    expect(props.onDeselectAll).not.toHaveBeenCalled();
  });

  it('"Deselectează toate" calls onDeselectAll when everything is selected', () => {
    const props = renderCategory({ selectedIds: new Set(['q1', 'q2']), selectedCount: 2 });
    fireEvent.click(screen.getByText('A. Financiar'));
    fireEvent.click(screen.getByText('Deselectează toate'));
    expect(props.onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it('toggling a checkbox reports the question id', () => {
    const props = renderCategory();
    fireEvent.click(screen.getByText('A. Financiar'));
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(props.onToggle).toHaveBeenCalledWith('q2');
  });

  it('shows the generating state instead of the badge and hides the list', () => {
    renderCategory({ isLoading: true });
    expect(screen.getByText('Se generează...')).toBeTruthy();
    fireEvent.click(screen.getByText('A. Financiar'));
    expect(screen.queryByText('Prima întrebare')).toBeNull();
    expect(screen.queryByText('Adaugă întrebare')).toBeNull();
  });

  it('shows the empty hint without questions', () => {
    renderCategory({ questions: [], selectedIds: new Set(), selectedCount: 0 });
    expect(screen.getByText('0/0')).toBeTruthy();
    fireEvent.click(screen.getByText('A. Financiar'));
    expect(screen.getByText('Nicio întrebare. Adaugă una mai jos.')).toBeTruthy();
    expect(screen.queryByText('Selectează toate')).toBeNull();
  });

  it('adds a custom question through the inline form (trimmed) and closes it', () => {
    const props = renderCategory();
    fireEvent.click(screen.getByText('A. Financiar'));
    fireEvent.click(screen.getByText('Adaugă întrebare'));
    const textarea = screen.getByPlaceholderText('Scrie întrebarea ta...');
    const add = screen.getByRole('button', { name: 'Adaugă' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(textarea, { target: { value: '  Întrebarea mea  ' } });
    expect((add as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(add);
    expect(props.onAddCustom).toHaveBeenCalledWith('Întrebarea mea');
    expect(screen.queryByPlaceholderText('Scrie întrebarea ta...')).toBeNull();
  });

  it('Enter submits and Escape cancels the inline form', () => {
    const props = renderCategory();
    fireEvent.click(screen.getByText('A. Financiar'));
    fireEvent.click(screen.getByText('Adaugă întrebare'));
    const textarea = screen.getByPlaceholderText('Scrie întrebarea ta...');
    fireEvent.change(textarea, { target: { value: 'Via Enter' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(props.onAddCustom).toHaveBeenCalledWith('Via Enter');

    fireEvent.click(screen.getByText('Adaugă întrebare'));
    fireEvent.keyDown(screen.getByPlaceholderText('Scrie întrebarea ta...'), { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Scrie întrebarea ta...')).toBeNull();
    expect(props.onAddCustom).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionCategoryList', () => {
  it('renders all five categories wired to the wizard', () => {
    const { result } = renderHook(() => useRequestWizard());
    act(() => result.current.setQuestionsForCategory('C_PLANIFICARE', ['x', 'y']));
    render(createElement(QuestionCategoryList, { wizard: result.current, isCategoryLoading: (c) => c === 'E_CONFORMITATE' }));
    for (const cat of CATEGORIES) expect(screen.getByText(cat.label)).toBeTruthy();
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByText('Se generează...')).toBeTruthy();
  });
});
