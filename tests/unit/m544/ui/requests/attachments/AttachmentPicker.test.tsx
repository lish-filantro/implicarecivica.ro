// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { AttachmentPicker } from '@m544/ui/requests/attachments/AttachmentPicker';
import type { OutgoingAttachment } from '@m544/requests/attachments';

afterEach(cleanup);

const pdf = (name = 'doc.pdf') => new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });
const toAtt = (f: File): OutgoingAttachment => ({ path: `u1/outgoing/x/${f.name}`, name: f.name, type: f.type, size: f.size });

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
});
