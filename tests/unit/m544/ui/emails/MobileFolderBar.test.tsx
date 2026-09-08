// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MobileFolderBar from '@m544/ui/emails/MobileFolderBar';

afterEach(cleanup);

const base = {
  activeFolder: 'inbox' as const,
  unreadCount: 2,
  onBack: () => undefined,
  onFolderChange: () => undefined,
  onCompose: () => undefined,
};

describe('MobileFolderBar', () => {
  it('shows the folder tabs with badges and the compose button when nothing is selected', () => {
    const onFolderChange = vi.fn();
    render(<MobileFolderBar {...base} hasSelection={false} reviewCount={4} onFolderChange={onFolderChange} />);
    expect(screen.getByText('Primite').textContent).toBe('Primite2');
    expect(screen.getByText('De revizuit').textContent).toBe('De revizuit4');
    expect(screen.getByText('Trimise').textContent).toBe('Trimise');
    expect(screen.getByText('Compune')).toBeTruthy();
    fireEvent.click(screen.getByText('De revizuit'));
    expect(onFolderChange).toHaveBeenCalledWith('review');
  });

  it('shows only the back button when an email is open', () => {
    const onBack = vi.fn();
    render(<MobileFolderBar {...base} hasSelection onBack={onBack} />);
    expect(screen.queryByText('Primite')).toBeNull();
    fireEvent.click(screen.getByText('Înapoi'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
