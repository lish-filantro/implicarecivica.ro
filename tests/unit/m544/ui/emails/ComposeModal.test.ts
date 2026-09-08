// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ComposeModal from '@m544/ui/emails/ComposeModal';
import { makeEmail } from './_fixtures';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const props = { isOpen: true, onClose: () => undefined, onSent: () => undefined, userEmail: 'ion@544.ro' };

describe('ComposeModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(h(ComposeModal, { ...props, isOpen: false }));
    expect(container.innerHTML).toBe('');
  });

  it('keeps Trimite disabled until recipient and body are filled', () => {
    render(h(ComposeModal, props));
    expect(screen.getByText('ion@544.ro')).toBeTruthy();
    const send = screen.getByRole('button', { name: 'Trimite' });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Către'), { target: { value: 'reg@primarie.ro' } });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Conținut'), { target: { value: 'Buna ziua' } });
    expect((send as HTMLButtonElement).disabled).toBe(false);

    // clearing the (pre-filled) subject disables again
    fireEvent.change(screen.getByLabelText('Subiect'), { target: { value: '   ' } });
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('posts to /api/emails/send, reports the email and closes', async () => {
    const sent = makeEmail({ id: 'sent1', type: 'sent' });
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ email: sent }) }));
    vi.stubGlobal('fetch', fetchMock);
    const onSent = vi.fn();
    const onClose = vi.fn();
    render(h(ComposeModal, { ...props, onSent, onClose }));

    fireEvent.change(screen.getByLabelText('Către'), { target: { value: 'reg@primarie.ro' } });
    fireEvent.change(screen.getByLabelText('Conținut'), { target: { value: 'Buna ziua' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trimite' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(sent));
    expect(onClose).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/emails/send');
    expect(JSON.parse(init.body as string)).toEqual({
      to: 'reg@primarie.ro',
      subject: 'Solicitare informatii publice - Legea 544/2001',
      body: 'Buna ziua',
    });
  });

  it('shows the API error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Limita zilnica atinsa' }) })));
    render(h(ComposeModal, props));
    fireEvent.change(screen.getByLabelText('Către'), { target: { value: 'reg@primarie.ro' } });
    fireEvent.change(screen.getByLabelText('Conținut'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trimite' }));
    await waitFor(() => expect(screen.getByText('Limita zilnica atinsa')).toBeTruthy());
  });
});
