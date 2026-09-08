// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, fireEvent } from '@testing-library/react';
import OtpInput, { emptyOtpCode, OTP_LENGTH } from '@m544/ui/auth/OtpInput';

/** Controlled harness, as the verify page uses it. */
function Harness({ onCode }: { onCode?: (code: string[]) => void }) {
  const [code, setCode] = useState<string[]>(emptyOtpCode);
  return (
    <OtpInput
      code={code}
      onChange={(next) => {
        setCode(next);
        onCode?.(next);
      }}
    />
  );
}

function boxes(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input'));
}

describe('OtpInput', () => {
  it('renders 8 numeric single-character boxes and focuses the first', () => {
    const { container } = render(<Harness />);
    const inputs = boxes(container);
    expect(inputs).toHaveLength(OTP_LENGTH);
    expect(inputs.every((i) => i.maxLength === 1 && i.inputMode === 'numeric')).toBe(true);
    expect(inputs.every((i) => i.autocomplete === 'one-time-code')).toBe(true);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('typing a digit fills the box and advances focus; the last box does not advance', () => {
    const onCode = vi.fn();
    const { container } = render(<Harness onCode={onCode} />);
    const inputs = boxes(container);

    fireEvent.change(inputs[0], { target: { value: '4' } });
    expect(inputs[0].value).toBe('4');
    expect(document.activeElement).toBe(inputs[1]);
    expect(onCode).toHaveBeenLastCalledWith(['4', '', '', '', '', '', '', '']);

    inputs[7].focus();
    fireEvent.change(inputs[7], { target: { value: '9' } });
    expect(inputs[7].value).toBe('9');
    expect(document.activeElement).toBe(inputs[7]);
  });

  it('rejects non-digits', () => {
    const onCode = vi.fn();
    const { container } = render(<Harness onCode={onCode} />);
    fireEvent.change(boxes(container)[0], { target: { value: 'a' } });
    expect(onCode).not.toHaveBeenCalled();
    expect(boxes(container)[0].value).toBe('');
  });

  it('paste distributes the digits over the 8 boxes and focuses the last filled one', () => {
    const onCode = vi.fn();
    const { container } = render(<Harness onCode={onCode} />);
    const group = container.firstElementChild as HTMLElement;

    fireEvent.paste(group, { clipboardData: { getData: () => '1234-5678 90' } });
    expect(boxes(container).map((i) => i.value)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(document.activeElement).toBe(boxes(container)[7]);

    fireEvent.paste(group, { clipboardData: { getData: () => '12' } });
    expect(boxes(container).map((i) => i.value)).toEqual(['1', '2', '', '', '', '', '', '']);
    expect(document.activeElement).toBe(boxes(container)[1]);
  });

  it('paste without digits changes nothing', () => {
    const onCode = vi.fn();
    const { container } = render(<Harness onCode={onCode} />);
    fireEvent.paste(container.firstElementChild as HTMLElement, { clipboardData: { getData: () => 'abc' } });
    expect(onCode).not.toHaveBeenCalled();
  });

  it('backspace on an empty box moves focus back; on a filled box it stays', () => {
    const { container } = render(<Harness />);
    const inputs = boxes(container);

    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.change(inputs[1], { target: { value: '5' } }); // focus -> inputs[2]
    inputs[1].focus();
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[1]);

    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[0]); // nothing before the first box
  });
});
