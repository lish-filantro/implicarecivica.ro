// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { QuestionAttachmentPicker } from '@m544/ui/requests/attachments/AttachmentPicker';
import { useWizardQuestions } from '@m544/ui/requests/wizard/useWizardQuestions';
import type { OutgoingAttachment } from '@m544/requests/attachments';

afterEach(cleanup);

const pdf = (name = 'doc.pdf') => new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });
const toAtt = (f: File): OutgoingAttachment => ({ path: `u1/outgoing/x/${f.name}`, name: f.name, type: f.type, size: f.size });

type Wizard = ReturnType<typeof useWizardQuestions>;

/**
 * Părintele real: wizard-ul ţine starea, picker-ul doar o arată. `show` imită tot ce demontează
 * picker-ul în aplicaţie — categorie strânsă, editare, pasul 1 — fără să atingă selecţia.
 */
function Harness({ upload, show = true, probe }: { upload: (f: File) => Promise<OutgoingAttachment>; show?: boolean; probe: { current?: Wizard } }) {
  const w = useWizardQuestions({ upload });
  probe.current = w;
  const q = w.questions.A_FINANCIAR[0];
  if (!q || !show) return null;
  return <QuestionAttachmentPicker question={q} api={w.questionAttachments} />;
}

function setup(upload: (f: File) => Promise<OutgoingAttachment>, initial: OutgoingAttachment[] = []) {
  const probe: { current?: Wizard } = {};
  const view = render(<Harness upload={upload} probe={probe} />);
  act(() => probe.current!.addCustomQuestion('A_FINANCIAR', 'Care e bugetul?'));
  const id = probe.current!.questions.A_FINANCIAR[0].id;
  for (const a of initial) {
    // Fişierele „deja urcate" intră pe acelaşi drum ca în aplicaţie.
    act(() => {
      void probe.current!.questionAttachments.add(id, [new File(['%PDF'], a.name, { type: 'application/pdf' })]);
    });
  }
  const setShow = (show: boolean) => view.rerender(<Harness upload={upload} probe={probe} show={show} />);
  return { probe, setShow };
}

const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

/** Încărcări ţinute în loc până le rezolvă sau respinge testul. */
function controlledUpload() {
  const calls: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
  const upload = vi.fn(
    (f: File) => new Promise<OutgoingAttachment>((resolve, reject) => calls.push({ resolve: () => resolve(toAtt(f)), reject })),
  );
  return { upload, calls };
}

describe('AttachmentPicker', () => {
  it('urcă fişierul ales şi îl afişează cu mărimea', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    setup(upload);
    fireEvent.change(input(), { target: { files: [pdf('groapa.pdf')] } });
    await waitFor(() => expect(screen.getByText('groapa.pdf')).toBeTruthy());
    expect(screen.getByText(/MB$/)).toBeTruthy();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('refuză un tip neacceptat fără să-l urce, şi blochează până e scos', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    const { probe } = setup(upload);
    fireEvent.change(input(), { target: { files: [new File(['x'], 'a.docx', { type: 'application/msword' })] } });
    await waitFor(() => expect(screen.getByText(/nu e acceptat/)).toBeTruthy());
    expect(upload).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Reîncearcă/ })).toBeNull();
    expect(probe.current!.canProceedToStep3).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Elimină a\.docx/ }));
    await waitFor(() => expect(probe.current!.canProceedToStep3).toBe(true));
    expect(screen.queryByText(/nu e acceptat/)).toBeNull();
  });

  it('scoate un fişier deja urcat', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    setup(upload, [toAtt(pdf('vechi.pdf'))]);
    await waitFor(() => expect(screen.getByText('vechi.pdf')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Elimină vechi\.pdf/ }));
    await waitFor(() => expect(screen.queryByText('vechi.pdf')).toBeNull());
  });

  it('arată eroarea de încărcare şi permite reîncercarea', async () => {
    let fail = true;
    const upload = vi.fn(async (f: File) => {
      if (fail) {
        fail = false;
        throw new Error('rețea');
      }
      return toAtt(f);
    });
    setup(upload);
    fireEvent.change(input(), { target: { files: [pdf('doc.pdf')] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeTruthy());
    expect(screen.getByText('rețea')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Reîncearcă/ })).toBeNull());
    expect(screen.getByText('doc.pdf')).toBeTruthy();
  });

  it('limitează la 5 fişiere pe o singură selecţie', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    setup(upload);
    fireEvent.change(input(), { target: { files: [1, 2, 3, 4, 5, 6].map((n) => pdf(`f${n}.pdf`)) } });
    await waitFor(() => expect(screen.getByText(/Cel mult 5/)).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(5);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(screen.getByText(`f${n}.pdf`)).toBeTruthy();
  });

  it('o încărcare în curs când picker-ul se demontează ţine previzualizarea blocată, apoi ajunge pe întrebare', async () => {
    const { upload, calls } = controlledUpload();
    const { probe, setShow } = setup(upload);
    fireEvent.change(input(), { target: { files: [pdf('dovada.pdf')] } });
    await waitFor(() => expect(screen.getByText(/se încarcă/)).toBeTruthy());
    setShow(false); // ex. categoria strânsă
    expect(input()).toBeNull();
    expect(probe.current!.canProceedToStep3).toBe(false);
    await act(async () => calls[0].resolve());
    expect(probe.current!.canProceedToStep3).toBe(true);
    setShow(true);
    expect(screen.getByText('dovada.pdf')).toBeTruthy();
    expect(screen.queryByText(/se încarcă/)).toBeNull();
  });

  it('un fişier eşuat supravieţuieşte demontării şi remontării picker-ului, şi tot blochează', async () => {
    const { upload, calls } = controlledUpload();
    const { probe, setShow } = setup(upload);
    fireEvent.change(input(), { target: { files: [pdf('doc.pdf')] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    await act(async () => calls[0].reject(new Error('rețea')));
    expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeTruthy();
    setShow(false);
    expect(probe.current!.canProceedToStep3).toBe(false);
    setShow(true);
    expect(screen.getByText('rețea')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeTruthy();
    expect(probe.current!.canProceedToStep3).toBe(false);
  });
});
