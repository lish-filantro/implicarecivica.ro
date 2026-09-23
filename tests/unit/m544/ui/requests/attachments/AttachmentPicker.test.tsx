// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { AttachmentPicker } from '@m544/ui/requests/attachments/AttachmentPicker';
import type { OutgoingAttachment } from '@m544/requests/attachments';

afterEach(cleanup);

const pdf = (name = 'doc.pdf') => new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });
const toAtt = (f: File): OutgoingAttachment => ({ path: `u1/outgoing/x/${f.name}`, name: f.name, type: f.type, size: f.size });
/** `File` calculează `size` din conţinut; pentru testele de buget avem nevoie de mărimi fixate. */
const sized = (name: string, size: number) => {
  const f = pdf(name);
  Object.defineProperty(f, 'size', { value: size, configurable: true });
  return f;
};

/** Ţine starea ca părintele real, ca `onChange` să se vadă în randare. */
function Harness(props: { upload: (f: File) => Promise<OutgoingAttachment>; onBusy?: (b: boolean) => void; initial?: OutgoingAttachment[] }) {
  const [atts, setAtts] = useState<OutgoingAttachment[]>(props.initial ?? []);
  return <AttachmentPicker attachments={atts} onChange={setAtts} onBusyChange={props.onBusy} upload={props.upload} />;
}

const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('AttachmentPicker', () => {
  it('urcă fişierul ales şi îl afişează cu mărimea', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    render(<Harness upload={upload} />);
    fireEvent.change(input(), { target: { files: [pdf('groapa.pdf')] } });
    await waitFor(() => expect(screen.getByText('groapa.pdf')).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('refuză un tip neacceptat fără să-l urce, şi blochează până e scos', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    const onBusy = vi.fn();
    render(<Harness upload={upload} onBusy={onBusy} />);
    fireEvent.change(input(), { target: { files: [new File(['x'], 'a.docx', { type: 'application/msword' })] } });
    await waitFor(() => expect(screen.getByText(/nu e acceptat/)).toBeTruthy());
    expect(upload).not.toHaveBeenCalled();
    expect(onBusy).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /Elimină a\.docx/ }));
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false));
  });

  it('scoate un fişier deja urcat', async () => {
    render(<Harness upload={async (f) => toAtt(f)} initial={[toAtt(pdf('vechi.pdf'))]} />);
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
    render(<Harness upload={upload} />);
    fireEvent.change(input(), { target: { files: [pdf('doc.pdf')] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Reîncearcă/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Reîncearcă/ })).toBeNull());
    expect(screen.getByText('doc.pdf')).toBeTruthy();
  });

  it('limitează la 5 fişiere pe o singură selecţie', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    render(<Harness upload={upload} />);
    const files = [1, 2, 3, 4, 5, 6].map((n) => pdf(`f${n}.pdf`));
    fireEvent.change(input(), { target: { files } });
    await waitFor(() => expect(screen.getByText(/Cel mult 5/)).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(5);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`f${n}.pdf`)).toBeTruthy();
    }
    expect(screen.queryByText('f6.pdf')).toBeTruthy();
  });

  it('limitează suma la 20 MB pe o singură selecţie', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    render(<Harness upload={upload} />);
    const MB = 1024 * 1024;
    const files = [sized('a.pdf', 8 * MB), sized('b.pdf', 8 * MB), sized('c.pdf', 8 * MB)];
    fireEvent.change(input(), { target: { files } });
    await waitFor(() => expect(screen.getByText(/Împreună/)).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText('b.pdf')).toBeTruthy();
  });

  it('numără fişierul aflat încă în curs de urcare la o a doua selecţie', async () => {
    const resolvers: Array<() => void> = [];
    const upload = vi.fn(
      (f: File) => new Promise<OutgoingAttachment>((resolve) => resolvers.push(() => resolve(toAtt(f)))),
    );
    const existing = [1, 2, 3, 4].map((n) => toAtt(pdf(`existent-${n}.pdf`)));
    render(<Harness upload={upload} initial={existing} />);
    fireEvent.change(input(), { target: { files: [pdf('cinci.pdf')] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    fireEvent.change(input(), { target: { files: [pdf('sase.pdf')] } });
    await waitFor(() => expect(screen.getByText(/Cel mult 5/)).toBeTruthy());
    expect(upload).toHaveBeenCalledTimes(1);
    resolvers[0]();
    await waitFor(() => expect(screen.getByText('cinci.pdf')).toBeTruthy());
  });

  it('eliberează starea „ocupat" la demontare', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    const onBusy = vi.fn();
    const { unmount } = render(<Harness upload={upload} onBusy={onBusy} />);
    fireEvent.change(input(), { target: { files: [new File(['x'], 'a.docx', { type: 'application/msword' })] } });
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(true));
    unmount();
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it('nu retrigger-uiește onBusyChange când doar identitatea funcţiei se schimbă', async () => {
    const upload = vi.fn(async (f: File) => toAtt(f));
    const onBusy1 = vi.fn();
    const { rerender } = render(<Harness upload={upload} onBusy={onBusy1} />);
    fireEvent.change(input(), { target: { files: [new File(['x'], 'a.docx', { type: 'application/msword' })] } });
    await waitFor(() => expect(onBusy1).toHaveBeenLastCalledWith(true));
    const callsAfterRefuse = onBusy1.mock.calls.length;
    const onBusy2 = vi.fn();
    rerender(<Harness upload={upload} onBusy={onBusy2} />);
    expect(onBusy1.mock.calls.length).toBe(callsAfterRefuse);
    expect(onBusy2).not.toHaveBeenCalled();
  });
});
