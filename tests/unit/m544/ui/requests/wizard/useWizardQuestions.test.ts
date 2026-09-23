// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardQuestions, createQuestionIdGenerator } from '@m544/ui/requests/wizard/useWizardQuestions';
import { CATEGORY_IDS } from '@m544/ui/requests/wizard/types';
import type { OutgoingAttachment } from '@m544/requests/attachments';

function setup() {
  return renderHook(() => useWizardQuestions());
}

describe('createQuestionIdGenerator', () => {
  it('produces unique ids within an instance', () => {
    const next = createQuestionIdGenerator('t');
    const ids = new Set(Array.from({ length: 500 }, () => next()));
    expect(ids.size).toBe(500);
    expect([...ids][0]).toBe('q_t_1');
  });

  it('produces distinct ids across instances (random token)', () => {
    const a = createQuestionIdGenerator();
    const b = createQuestionIdGenerator();
    expect(a()).not.toBe(b());
  });
});

describe('useWizardQuestions', () => {
  it('starts with empty categories and nothing selected', () => {
    const { result } = setup();
    for (const cat of CATEGORY_IDS) expect(result.current.questions[cat]).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.canProceedToStep3).toBe(false);
  });

  it('setQuestionsForCategory creates items with unique ids, left unselected', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['Q1', 'Q2', 'Q3']));
    const items = result.current.questions.A_FINANCIAR;
    expect(items.map((q) => q.text)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(items.every((q) => q.category === 'A_FINANCIAR' && !q.isCustom && !q.isEdited)).toBe(true);
    expect(new Set(items.map((q) => q.id)).size).toBe(3);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedCountByCategory.A_FINANCIAR).toBe(0);
    expect(result.current.canProceedToStep3).toBe(false);
  });

  it('ids stay unique across categories and across two hook instances', () => {
    const one = setup();
    const two = setup();
    act(() => {
      one.result.current.setQuestionsForCategory('A_FINANCIAR', ['a', 'b']);
      one.result.current.setQuestionsForCategory('B_RESPONSABILITATE', ['c', 'd']);
      two.result.current.setQuestionsForCategory('A_FINANCIAR', ['e', 'f']);
    });
    const all = [
      ...one.result.current.questions.A_FINANCIAR,
      ...one.result.current.questions.B_RESPONSABILITATE,
      ...two.result.current.questions.A_FINANCIAR,
    ].map((q) => q.id);
    expect(new Set(all).size).toBe(6);
  });

  it('setQuestionsForCategory replaces the category list (regeneration)', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['old']));
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['new1', 'new2']));
    expect(result.current.questions.A_FINANCIAR.map((q) => q.text)).toEqual(['new1', 'new2']);
    expect(result.current.selectedCountByCategory.A_FINANCIAR).toBe(0);
  });

  it('regeneration keeps the custom questions of the category', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['old']));
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'mine'));
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['new']));
    expect(result.current.questions.A_FINANCIAR.map((q) => q.text)).toEqual(['new', 'mine']);
    // the custom question keeps its selection; the regenerated one starts unselected
    expect(result.current.selectedCountByCategory.A_FINANCIAR).toBe(1);
  });

  it('toggleQuestion flips selection', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('C_PLANIFICARE', ['x']));
    const id = result.current.questions.C_PLANIFICARE[0].id;
    act(() => result.current.toggleQuestion(id));
    expect(result.current.selectedQuestionIds.has(id)).toBe(true);
    expect(result.current.canProceedToStep3).toBe(true);
    act(() => result.current.toggleQuestion(id));
    expect(result.current.selectedQuestionIds.has(id)).toBe(false);
    expect(result.current.canProceedToStep3).toBe(false);
  });

  it('selectAll / deselectAll act only on the given category', () => {
    const { result } = setup();
    act(() => {
      result.current.setQuestionsForCategory('A_FINANCIAR', ['a1', 'a2']);
      result.current.setQuestionsForCategory('B_RESPONSABILITATE', ['b1']);
    });
    act(() => result.current.selectAllInCategory('B_RESPONSABILITATE'));
    expect(result.current.selectedCountByCategory).toMatchObject({ A_FINANCIAR: 0, B_RESPONSABILITATE: 1 });
    act(() => result.current.selectAllInCategory('A_FINANCIAR'));
    expect(result.current.selectedCountByCategory).toMatchObject({ A_FINANCIAR: 2, B_RESPONSABILITATE: 1 });
    expect(result.current.selectedCount).toBe(3);
    act(() => result.current.deselectAllInCategory('A_FINANCIAR'));
    expect(result.current.selectedCountByCategory).toMatchObject({ A_FINANCIAR: 0, B_RESPONSABILITATE: 1 });
  });

  it('editQuestion changes the text and flags generated questions as edited', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('D_MONITORIZARE', ['orig']));
    const id = result.current.questions.D_MONITORIZARE[0].id;
    act(() => result.current.editQuestion(id, 'changed'));
    expect(result.current.questions.D_MONITORIZARE[0]).toMatchObject({ text: 'changed', isEdited: true, isCustom: false });
  });

  it('editing a custom question keeps it custom and not "edited"', () => {
    const { result } = setup();
    act(() => result.current.addCustomQuestion('E_CONFORMITATE', 'mine'));
    const id = result.current.questions.E_CONFORMITATE[0].id;
    act(() => result.current.editQuestion(id, 'mine v2'));
    expect(result.current.questions.E_CONFORMITATE[0]).toMatchObject({ text: 'mine v2', isEdited: false, isCustom: true });
  });

  it('addCustomQuestion appends a selected custom item', () => {
    const { result } = setup();
    act(() => result.current.setQuestionsForCategory('A_FINANCIAR', ['gen']));
    act(() => result.current.addCustomQuestion('A_FINANCIAR', 'custom'));
    const items = result.current.questions.A_FINANCIAR;
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ text: 'custom', isCustom: true, isEdited: false, category: 'A_FINANCIAR' });
    expect(result.current.selectedQuestionIds.has(items[1].id)).toBe(true);
    expect(items[0].id).not.toBe(items[1].id);
  });

  it('removeQuestion drops the item and its selection', () => {
    const { result } = setup();
    act(() => result.current.addCustomQuestion('B_RESPONSABILITATE', 'to remove'));
    const id = result.current.questions.B_RESPONSABILITATE[0].id;
    act(() => result.current.removeQuestion(id));
    expect(result.current.questions.B_RESPONSABILITATE).toEqual([]);
    expect(result.current.selectedQuestionIds.has(id)).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('getSelectedQuestions returns selected items in category order', () => {
    const { result } = setup();
    act(() => {
      result.current.setQuestionsForCategory('E_CONFORMITATE', ['e1']);
      result.current.setQuestionsForCategory('A_FINANCIAR', ['a1', 'a2']);
    });
    act(() => {
      result.current.toggleQuestion(result.current.questions.A_FINANCIAR[1].id);
      result.current.toggleQuestion(result.current.questions.E_CONFORMITATE[0].id);
    });
    expect(result.current.getSelectedQuestions().map((q) => q.text)).toEqual(['a2', 'e1']);
  });
});

describe('useWizardQuestions — ataşamente', () => {
  // Starea încărcărilor (în curs / eşuate) stă în hook, pe id-ul întrebării, nu în picker: picker-ul
  // se demontează la lucruri obişnuite (categorie strânsă, editare, pasul 1, deselectare), iar un
  // fişier în zbor sau eşuat nu are voie să dispară odată cu el (spec §4.3, §4.4).
  const pdf = (name = 'doc.pdf', size?: number) => {
    const f = new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });
    if (size !== undefined) Object.defineProperty(f, 'size', { value: size, configurable: true });
    return f;
  };
  const toAtt = (f: File): OutgoingAttachment => ({ path: `u1/outgoing/${f.name}/${f.name}`, name: f.name, type: f.type, size: f.size });

  /** Încărcări controlate din test: fiecare apel aşteaptă până e rezolvat sau respins explicit. */
  function controlledUpload() {
    const calls: Array<{ file: File; resolve: () => void; reject: (e: Error) => void }> = [];
    const upload = vi.fn(
      (file: File) =>
        new Promise<OutgoingAttachment>((resolve, reject) => {
          calls.push({ file, resolve: () => resolve(toAtt(file)), reject });
        }),
    );
    return { upload, calls };
  }

  function withQuestion(upload: (f: File) => Promise<OutgoingAttachment>) {
    const hook = renderHook(() => useWizardQuestions({ upload }));
    act(() => hook.result.current.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
    const id = hook.result.current.getSelectedQuestions()[0].id;
    const question = () => hook.result.current.questions.A_FINANCIAR.find((q) => q.id === id)!;
    const pending = () => hook.result.current.questionAttachments.pending[id] ?? [];
    const add = (files: File[]) => {
      let done!: Promise<void>;
      act(() => {
        done = hook.result.current.questionAttachments.add(id, files);
      });
      return done;
    };
    return { hook, id, question, pending, add };
  }

  it('cât timp un fişier se încarcă, previzualizarea e blocată; după, e pe întrebare şi se deblochează', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, question, pending, add } = withQuestion(upload);
    const done = add([pdf('dovada.pdf')]);
    expect(pending().map((p) => p.status)).toEqual(['uploading']);
    expect(hook.result.current.hasBusyAttachments).toBe(true);
    expect(hook.result.current.canProceedToStep3).toBe(false);
    await act(async () => {
      calls[0].resolve();
      await done;
    });
    expect(question().attachments?.map((a) => a.name)).toEqual(['dovada.pdf']);
    expect(pending()).toEqual([]);
    expect(hook.result.current.canProceedToStep3).toBe(true);
  });

  it('refuză un tip neacceptat fără să-l urce, şi blochează până e scos', async () => {
    const { upload } = controlledUpload();
    const { hook, id, pending, add } = withQuestion(upload);
    await act(async () => {
      await add([new File(['x'], 'a.docx', { type: 'application/msword' })]);
    });
    expect(upload).not.toHaveBeenCalled();
    expect(pending()).toMatchObject([{ status: 'error', error: expect.stringMatching(/nu e acceptat/) }]);
    expect(pending()[0].file).toBeUndefined();
    expect(hook.result.current.canProceedToStep3).toBe(false);
    act(() => hook.result.current.questionAttachments.dismiss(id, pending()[0].key));
    expect(pending()).toEqual([]);
    expect(hook.result.current.canProceedToStep3).toBe(true);
  });

  it('un fişier eşuat la urcare rămâne şi blochează până e scos', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, id, pending, add } = withQuestion(upload);
    const done = add([pdf('doc.pdf')]);
    await act(async () => {
      calls[0].reject(new Error('rețea'));
      await done;
    });
    expect(pending()).toMatchObject([{ status: 'error', error: 'rețea', name: 'doc.pdf' }]);
    expect(hook.result.current.canProceedToStep3).toBe(false);
    act(() => hook.result.current.questionAttachments.dismiss(id, pending()[0].key));
    expect(pending()).toEqual([]);
    expect(hook.result.current.canProceedToStep3).toBe(true);
  });

  it('o întrebare deselectată cu un fişier eşuat nu blochează; rebifată, blochează din nou şi rândul e tot acolo', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, id, pending, add } = withQuestion(upload);
    act(() => hook.result.current.addCustomQuestion('A_FINANCIAR', 'Altă întrebare'));
    const done = add([pdf('doc.pdf')]);
    await act(async () => {
      calls[0].reject(new Error('rețea'));
      await done;
    });
    act(() => hook.result.current.toggleQuestion(id));
    expect(hook.result.current.hasBusyAttachments).toBe(false);
    expect(hook.result.current.canProceedToStep3).toBe(true);
    act(() => hook.result.current.toggleQuestion(id));
    expect(hook.result.current.hasBusyAttachments).toBe(true);
    expect(hook.result.current.canProceedToStep3).toBe(false);
    expect(pending()).toMatchObject([{ status: 'error', name: 'doc.pdf' }]);
  });

  it('o încărcare care se termină după ce omul a adăugat alt fişier le păstrează pe AMBELE', async () => {
    const { upload, calls } = controlledUpload();
    const { question, add } = withQuestion(upload);
    const first = add([pdf('lent.pdf')]);
    const second = add([pdf('rapid.pdf')]);
    await act(async () => {
      calls[1].resolve();
      await second;
    });
    expect(question().attachments?.map((a) => a.name)).toEqual(['rapid.pdf']);
    await act(async () => {
      calls[0].resolve();
      await first;
    });
    expect(question().attachments?.map((a) => a.name)).toEqual(['rapid.pdf', 'lent.pdf']);
  });

  it('scoaterea unui fişier urcat nu atinge unul care se încarcă între timp', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, id, question, add } = withQuestion(upload);
    const a = add([pdf('vechi.pdf')]);
    await act(async () => {
      calls[0].resolve();
      await a;
    });
    const b = add([pdf('nou.pdf')]);
    act(() => hook.result.current.questionAttachments.remove(id, question().attachments![0].path));
    await act(async () => {
      calls[1].resolve();
      await b;
    });
    expect(question().attachments?.map((x) => x.name)).toEqual(['nou.pdf']);
  });

  it('limitează la 5 fişiere pe o singură selecţie', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    const { question, pending, add } = withQuestion(upload);
    await act(async () => {
      await add([1, 2, 3, 4, 5, 6].map((n) => pdf(`f${n}.pdf`)));
    });
    expect(upload).toHaveBeenCalledTimes(5);
    expect(question().attachments).toHaveLength(5);
    expect(pending()).toMatchObject([{ name: 'f6.pdf', status: 'error', error: expect.stringMatching(/Cel mult 5/) }]);
  });

  it('limitează suma la 20 MB pe o singură selecţie', async () => {
    const MB = 1024 * 1024;
    const upload = vi.fn(async (f: File) => toAtt(f));
    const { question, pending, add } = withQuestion(upload);
    await act(async () => {
      await add([pdf('a.pdf', 8 * MB), pdf('b.pdf', 8 * MB), pdf('c.pdf', 8 * MB)]);
    });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(question().attachments?.map((a) => a.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(pending()).toMatchObject([{ name: 'c.pdf', error: expect.stringMatching(/Împreună/) }]);
  });

  it('bugetul numără fişierele încă în zbor, din selecţii separate', () => {
    const { upload } = controlledUpload();
    const { pending, add } = withQuestion(upload);
    for (const n of [1, 2, 3, 4, 5, 6]) void add([pdf(`f${n}.pdf`)]);
    expect(upload).toHaveBeenCalledTimes(5);
    expect(pending().at(-1)).toMatchObject({ name: 'f6.pdf', status: 'error', error: expect.stringMatching(/Cel mult 5/) });
  });

  it('„Reîncearcă" verifică din nou bugetul', async () => {
    const MB = 1024 * 1024;
    const { upload, calls } = controlledUpload();
    const { hook, id, question, pending, add } = withQuestion(upload);
    const failing = add([pdf('mare.pdf', 9 * MB)]);
    await act(async () => {
      calls[0].reject(new Error('rețea'));
      await failing;
    });
    // Cât timp „mare.pdf" e eşuat, omul adaugă alte două de 8 MB: încap, fiindcă cel eşuat nu contează.
    for (const name of ['a.pdf', 'b.pdf']) {
      const p = add([pdf(name, 8 * MB)]);
      await act(async () => {
        calls.at(-1)!.resolve();
        await p;
      });
    }
    expect(question().attachments).toHaveLength(2);
    const callsBefore = upload.mock.calls.length;
    await act(async () => {
      await hook.result.current.questionAttachments.retry(id, pending()[0].key);
    });
    expect(upload.mock.calls.length).toBe(callsBefore);
    expect(pending()).toMatchObject([{ name: 'mare.pdf', status: 'error', error: expect.stringMatching(/Împreună/) }]);
    expect(hook.result.current.canProceedToStep3).toBe(false);
  });

  it('„Reîncearcă" după o eroare de reţea urcă fişierul', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, id, question, pending, add } = withQuestion(upload);
    const p = add([pdf('doc.pdf')]);
    await act(async () => {
      calls[0].reject(new Error('rețea'));
      await p;
    });
    let r!: Promise<void>;
    act(() => {
      r = hook.result.current.questionAttachments.retry(id, pending()[0].key);
    });
    expect(pending()).toMatchObject([{ status: 'uploading' }]);
    expect(hook.result.current.canProceedToStep3).toBe(false);
    await act(async () => {
      calls[1].resolve();
      await r;
    });
    expect(pending()).toEqual([]);
    expect(question().attachments?.map((a) => a.name)).toEqual(['doc.pdf']);
    expect(hook.result.current.canProceedToStep3).toBe(true);
  });

  it('ştergerea întrebării îi curăţă fişierele în aşteptare şi eliberează blocarea', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, id, add } = withQuestion(upload);
    const p = add([pdf('doc.pdf')]);
    await act(async () => {
      calls[0].reject(new Error('rețea'));
      await p;
    });
    act(() => hook.result.current.addCustomQuestion('A_FINANCIAR', 'Altă întrebare'));
    act(() => hook.result.current.removeQuestion(id));
    expect(hook.result.current.questionAttachments.pending[id]).toBeUndefined();
    expect(hook.result.current.canProceedToStep3).toBe(true);
  });

  it('o încărcare care se termină după ştergerea întrebării nu o readuce', async () => {
    const { upload, calls } = controlledUpload();
    const { hook, id, add } = withQuestion(upload);
    const p = add([pdf('doc.pdf')]);
    act(() => hook.result.current.removeQuestion(id));
    await act(async () => {
      calls[0].resolve();
      await p;
    });
    expect(hook.result.current.questions.A_FINANCIAR).toEqual([]);
    expect(hook.result.current.questionAttachments.pending[id]).toBeUndefined();
  });

  it('regenerarea categoriei scoate întrebarea înlocuită din selecţie şi din aşteptare; previzualizarea se deblochează', async () => {
    const { upload, calls } = controlledUpload();
    const hook = renderHook(() => useWizardQuestions({ upload }));
    act(() => hook.result.current.setQuestionsForCategory('A_FINANCIAR', ['generată']));
    act(() => hook.result.current.addCustomQuestion('B_RESPONSABILITATE', 'a mea'));
    const oldId = hook.result.current.questions.A_FINANCIAR[0].id;
    act(() => hook.result.current.toggleQuestion(oldId));
    let done!: Promise<void>;
    act(() => {
      done = hook.result.current.questionAttachments.add(oldId, [pdf('doc.pdf')]);
    });
    await act(async () => {
      calls[0].reject(new Error('rețea'));
      await done;
    });
    expect(hook.result.current.selectedCount).toBe(2);
    expect(hook.result.current.canProceedToStep3).toBe(false);

    act(() => hook.result.current.setQuestionsForCategory('A_FINANCIAR', ['nouă']));

    expect(hook.result.current.selectedQuestionIds.has(oldId)).toBe(false);
    expect(hook.result.current.selectedCount).toBe(1);
    expect(hook.result.current.questionAttachments.pending[oldId]).toBeUndefined();
    expect(hook.result.current.hasBusyAttachments).toBe(false);
    expect(hook.result.current.canProceedToStep3).toBe(true);
  });
});
