// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import EmailSidebar, { folderBadge } from '@m544/ui/emails/EmailSidebar';

afterEach(cleanup);

const base = { activeFolder: 'inbox' as const, onCompose: () => undefined, userEmail: 'ion@544.ro' };

describe('EmailSidebar', () => {
  it('lists the four folders with unread and review badges', () => {
    render(<EmailSidebar {...base} onFolderChange={() => undefined} unreadCount={3} reviewCount={2} />);
    for (const label of ['Primite', 'De revizuit', 'Trimise', 'Toate']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId('badge-inbox').textContent).toBe('3');
    expect(screen.getByTestId('badge-review').textContent).toBe('2');
    expect(screen.queryByTestId('badge-sent')).toBeNull();
    expect(screen.getByText('ion@544.ro')).toBeTruthy();
  });

  it('hides the badges at zero (reviewCount defaults to 0)', () => {
    render(<EmailSidebar {...base} onFolderChange={() => undefined} unreadCount={0} />);
    expect(screen.queryByTestId('badge-inbox')).toBeNull();
    expect(screen.queryByTestId('badge-review')).toBeNull();
  });

  it('reports folder changes and compose clicks', () => {
    const onFolderChange = vi.fn();
    const onCompose = vi.fn();
    render(<EmailSidebar {...base} onCompose={onCompose} onFolderChange={onFolderChange} unreadCount={0} />);
    fireEvent.click(screen.getByText('De revizuit'));
    expect(onFolderChange).toHaveBeenCalledWith('review');
    fireEvent.click(screen.getByText('Compune'));
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it('folderBadge: only inbox (unread) and review (flagged) carry counts', () => {
    expect(folderBadge('inbox', 5, 1)).toBe(5);
    expect(folderBadge('review', 5, 1)).toBe(1);
    expect(folderBadge('review', 5, 0)).toBeNull();
    expect(folderBadge('sent', 5, 1)).toBeNull();
    expect(folderBadge('all', 5, 1)).toBeNull();
  });
});
