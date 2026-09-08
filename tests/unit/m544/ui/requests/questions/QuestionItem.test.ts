// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuestionItem } from '@m544/ui/requests/questions/QuestionItem';
import type { QuestionItem as Item } from '@m544/ui/requests/wizard/types';

const GENERATED: Item = { id: 'g', category: 'A_FINANCIAR', text: 'Text generat', isCustom: false, isEdited: false };
const CUSTOM: Item = { ...GENERATED, id: 'c', text: 'Text propriu', isCustom: true };

function renderItem(question: Item, overrides: Partial<Parameters<typeof QuestionItem>[0]> = {}) {
  const props = { question, isSelected: true, onToggle: vi.fn(), onEdit: vi.fn(), ...overrides };
  render(createElement(QuestionItem, props));
  return props;
}

afterEach(cleanup);

describe('QuestionItem', () => {
  it('renders the text, a checked checkbox and toggles on click', () => {
    const props = renderItem(GENERATED);
    expect(screen.getByText('Text generat')).toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByText('Text generat'));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onToggle).toHaveBeenCalledTimes(2);
  });

  it('marks edited questions', () => {
    renderItem({ ...GENERATED, isEdited: true });
    expect(screen.getByText('(editat)')).toBeTruthy();
  });

  it('enters edit mode with the current text and saves the trimmed change', () => {
    const props = renderItem(GENERATED);
    fireEvent.click(screen.getByTitle('Editează'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Text generat');
    fireEvent.change(textarea, { target: { value: '  Text nou  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvează/ }));
    expect(props.onEdit).toHaveBeenCalledWith('Text nou');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('does not report an unchanged or empty edit', () => {
    const props = renderItem(GENERATED);
    fireEvent.click(screen.getByTitle('Editează'));
    fireEvent.click(screen.getByRole('button', { name: /Salvează/ }));
    expect(props.onEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Editează'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('cancel (button or Escape) leaves edit mode without saving', () => {
    const props = renderItem(GENERATED);
    fireEvent.click(screen.getByTitle('Editează'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ceva' } });
    fireEvent.click(screen.getByRole('button', { name: /Anulează/ }));
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(screen.getByText('Text generat')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Editează'));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows the remove button only for custom questions with an onRemove handler', () => {
    const onRemove = vi.fn();
    renderItem(CUSTOM, { onRemove });
    fireEvent.click(screen.getByTitle('Șterge'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    cleanup();

    renderItem(GENERATED, { onRemove });
    expect(screen.queryByTitle('Șterge')).toBeNull();
    cleanup();

    renderItem(CUSTOM);
    expect(screen.queryByTitle('Șterge')).toBeNull();
  });
});
