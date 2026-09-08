// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EmailList from '@m544/ui/emails/EmailList';
import { makeEmail } from './_fixtures';

afterEach(cleanup);

const baseProps = {
  loading: false,
  selectedEmailId: null,
  onSelectEmail: () => undefined,
  activeFolder: 'inbox' as const,
  search: '',
  onSearchChange: () => undefined,
};

describe('EmailList', () => {
  it('renders unread emails bold and calls onSelectEmail on click', () => {
    const onSelectEmail = vi.fn();
    const unread = makeEmail({ id: 'u', subject: 'Necitit', is_read: false });
    const read = makeEmail({ id: 'r', subject: 'Citit', is_read: true });
    render(h(EmailList, { ...baseProps, emails: [unread, read], onSelectEmail }));

    expect(screen.getByText('Necitit').className).toContain('font-semibold');
    expect(screen.getByText('Citit').className).not.toContain('font-semibold');

    fireEvent.click(screen.getByText('Necitit'));
    expect(onSelectEmail).toHaveBeenCalledWith(unread);
  });

  it('shows category, processing and association badges including redirectionat', () => {
    const emails = [
      makeEmail({ id: 'a', category: 'redirectionat', processing_status: 'failed', request_id: 'req1' }),
      makeEmail({ id: 'b', category: 'irelevant', processing_status: 'pending' }),
      makeEmail({ id: 'c', category: 'inregistrate', processing_status: 'completed' }),
    ];
    render(h(EmailList, { ...baseProps, emails }));

    expect(screen.getByText('Redirecționat')).toBeTruthy();
    expect(screen.getByText('Eșuat')).toBeTruthy();
    expect(screen.getByText('Asociat')).toBeTruthy();
    expect(screen.getByText('Irelevant')).toBeTruthy();
    expect(screen.getByText('Neprocesar')).toBeTruthy();
    expect(screen.getByText('Înregistrat')).toBeTruthy();
  });

  it('prefixes sent emails with the recipient and shows a stripped preview', () => {
    render(
      h(EmailList, {
        ...baseProps,
        activeFolder: 'sent',
        emails: [makeEmail({ type: 'sent', to_email: 'x@primarie.ro', body: '<p>Buna  <b>ziua</b></p>' })],
      }),
    );
    expect(screen.getByText('Către: x@primarie.ro')).toBeTruthy();
    expect(screen.getByText('Buna ziua')).toBeTruthy();
  });

  it('renders empty states and the spinner', () => {
    render(h(EmailList, { ...baseProps, emails: [], activeFolder: 'sent' }));
    expect(screen.getByText('Nu ai trimis încă niciun email')).toBeTruthy();
    cleanup();
    render(h(EmailList, { ...baseProps, emails: [], search: 'abc' }));
    expect(screen.getByText('Niciun rezultat')).toBeTruthy();
    cleanup();
    render(h(EmailList, { ...baseProps, emails: [], loading: true }));
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('forwards search input changes', () => {
    const onSearchChange = vi.fn();
    render(h(EmailList, { ...baseProps, emails: [], onSearchChange }));
    fireEvent.change(screen.getByPlaceholderText('Caută în emailuri...'), { target: { value: 'primarie' } });
    expect(onSearchChange).toHaveBeenCalledWith('primarie');
  });
});
