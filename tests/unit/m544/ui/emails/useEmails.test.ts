// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmails, type EmailsDeps, type EmailChangeHandlers } from '@m544/ui/emails/useEmails';
import type { Email } from '@m544/shared/types/email';
import type { Profile } from '@m544/shared/types/profile';
import { makeEmail } from './_fixtures';

function fakeDeps(emails: Email[]) {
  let handlers: EmailChangeHandlers | null = null;
  const unsubscribe = vi.fn();
  const deps: EmailsDeps = {
    listEmails: vi.fn(async () => emails),
    getProfile: vi.fn(async () => ({ mailcow_email: 'ion@544.ro' }) as Profile),
    getUnreadCount: vi.fn(async () => emails.filter((e) => e.type === 'received' && !e.is_read).length),
    markEmailAsRead: vi.fn(async () => undefined),
    subscribe: vi.fn((onInsert: (e: Email) => void, onUpdate: (e: Email) => void) => {
      handlers = { onInsert, onUpdate };
      return unsubscribe;
    }),
  };
  const emit = (): EmailChangeHandlers => {
    if (!handlers) throw new Error('subscribe was not called');
    return handlers;
  };
  return { deps, emit, unsubscribe };
}

describe('useEmails', () => {
  it('loads emails, profile email and unread count', async () => {
    const unread = makeEmail({ id: 'u', is_read: false });
    const { deps } = fakeDeps([unread, makeEmail({ id: 's', type: 'sent' })]);
    const { result } = renderHook(() => useEmails(deps));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emails).toHaveLength(2);
    expect(result.current.userEmail).toBe('ion@544.ro');
    expect(result.current.unreadCount).toBe(1);
    // default folder is inbox -> only received
    expect(result.current.filteredEmails.map((e) => e.id)).toEqual(['u']);
  });

  it('realtime INSERT prepends the email once and bumps the unread count', async () => {
    const { deps, emit } = fakeDeps([makeEmail({ id: 'a' })]);
    const { result } = renderHook(() => useEmails(deps));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const incoming = makeEmail({ id: 'new', is_read: false });
    act(() => emit().onInsert(incoming));
    expect(result.current.emails.map((e) => e.id)).toEqual(['new', 'a']);
    expect(result.current.unreadCount).toBe(1);

    // sent emails do not touch the unread count
    act(() => emit().onInsert(makeEmail({ id: 'sent', type: 'sent', is_read: false })));
    expect(result.current.unreadCount).toBe(1);

    // a duplicate INSERT event does not add the email twice
    act(() => emit().onInsert(incoming));
    expect(result.current.emails.map((e) => e.id)).toEqual(['sent', 'new', 'a']);
  });

  it('realtime UPDATE replaces the email and the selected one', async () => {
    const { deps, emit } = fakeDeps([makeEmail({ id: 'a', subject: 'old' })]);
    const { result } = renderHook(() => useEmails(deps));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.selectEmail(result.current.emails[0]));
    act(() => emit().onUpdate(makeEmail({ id: 'a', subject: 'updated' })));

    expect(result.current.emails[0].subject).toBe('updated');
    expect(result.current.selectedEmail?.subject).toBe('updated');
  });

  it('selecting an unread received email marks it as read', async () => {
    const { deps } = fakeDeps([makeEmail({ id: 'u', is_read: false })]);
    const { result } = renderHook(() => useEmails(deps));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(1);

    act(() => result.current.selectEmail(result.current.emails[0]));
    await waitFor(() => expect(result.current.selectedEmail?.is_read).toBe(true));
    expect(deps.markEmailAsRead).toHaveBeenCalledWith('u');
    expect(result.current.emails[0].is_read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('changing folder clears selection and search; addSentEmail prepends', async () => {
    const { deps } = fakeDeps([makeEmail({ id: 'a' })]);
    const { result } = renderHook(() => useEmails(deps));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.selectEmail(result.current.emails[0]);
      result.current.setSearch('x');
    });
    act(() => result.current.changeFolder('sent'));
    expect(result.current.activeFolder).toBe('sent');
    expect(result.current.selectedEmail).toBeNull();
    expect(result.current.search).toBe('');

    act(() => result.current.addSentEmail(makeEmail({ id: 's', type: 'sent' })));
    expect(result.current.filteredEmails.map((e) => e.id)).toEqual(['s']);
  });

  it('unsubscribes on unmount', async () => {
    const { deps, unsubscribe } = fakeDeps([]);
    const { unmount, result } = renderHook(() => useEmails(deps));
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
