// @vitest-environment jsdom
/**
 * Editorul liber al pasului 2 pe drumul manual: omul îşi scrie singur întrebările, câte una pe
 * rând, fără categoriile A–E (care fără un set generat din chat rămâneau goale, 0/0).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FreeQuestionEditor } from '@m544/ui/requests/questions/FreeQuestionEditor';
import type { QuestionItem } from '@m544/ui/requests/wizard/types';

afterEach(cleanup);

const q = (id: string, text: string): QuestionItem => ({ id, category: 'A_FINANCIAR', text, isCustom: true, isEdited: false });

function setup(questions: QuestionItem[] = []) {
  const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onRemove: vi.fn() };
  render(<FreeQuestionEditor questions={questions} {...handlers} />);
  return handlers;
}

describe('FreeQuestionEditor', () => {
  it('fără întrebări: un mesaj care invită la scris şi butonul de adăugare', () => {
    setup();
    expect(screen.getByText(/Încă nu ai adăugat nicio întrebare/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Adaugă întrebare/ })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('câte un câmp pentru fiecare întrebare, în ordinea în care au fost scrise', () => {
    setup([q('1', 'Care este bugetul?'), q('2', 'Cine a semnat contractul?')]);
    const first = screen.getByRole('textbox', { name: 'Întrebarea 1' }) as HTMLTextAreaElement;
    const second = screen.getByRole('textbox', { name: 'Întrebarea 2' }) as HTMLTextAreaElement;
    expect(first.value).toBe('Care este bugetul?');
    expect(second.value).toBe('Cine a semnat contractul?');
    expect(screen.queryByText(/Încă nu ai adăugat/)).toBeNull();
  });

  it('modificarea textului ajunge în starea wizard-ului', () => {
    const { onEdit } = setup([q('1', 'Care este bugetul?')]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Întrebarea 1' }), { target: { value: 'Care este bugetul pe 2026?' } });
    expect(onEdit).toHaveBeenCalledWith('1', 'Care este bugetul pe 2026?');
  });

  it('la ieşirea din câmp, spaţiile de la capete dispar', () => {
    const { onEdit, onRemove } = setup([q('1', '  Care este bugetul?  ')]);
    fireEvent.blur(screen.getByRole('textbox', { name: 'Întrebarea 1' }));
    expect(onEdit).toHaveBeenCalledWith('1', 'Care este bugetul?');
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('o întrebare golită se şterge la ieşirea din câmp, ca să nu plece o cerere goală', () => {
    const { onRemove } = setup([q('1', '   ')]);
    fireEvent.blur(screen.getByRole('textbox', { name: 'Întrebarea 1' }));
    expect(onRemove).toHaveBeenCalledWith('1');
  });

  it('fiecare întrebare are butonul ei de ştergere', () => {
    const { onRemove } = setup([q('1', 'Unu'), q('2', 'Doi')]);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge întrebarea 2' }));
    expect(onRemove).toHaveBeenCalledWith('2');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('„Adaugă întrebare" deschide un câmp nou; textul se adaugă fără spaţiile de la capete', () => {
    const { onAdd } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Adaugă întrebare/ }));
    fireEvent.change(screen.getByPlaceholderText('Scrie întrebarea ta...'), { target: { value: '  Câte sesizări ați primit?  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
    expect(onAdd).toHaveBeenCalledWith('Câte sesizări ați primit?');
  });
});
