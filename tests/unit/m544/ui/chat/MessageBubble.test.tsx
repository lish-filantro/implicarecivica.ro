// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageBubble from '@m544/ui/chat/MessageBubble';
import type { Message } from '@m544/shared/types/chat';
import { STEP_2_REPLY } from './_fakes';

const bot = (text: string, extra: Partial<Message> = {}): Message => ({
  sender: 'bot',
  text,
  time: '10:00',
  ...extra,
});

describe('MessageBubble', () => {
  it('renders a bot message with markdown and web sources', () => {
    render(
      <MessageBubble
        message={bot('Salut **lume**', {
          webSearches: ['primăria pitești email'],
          webSources: [{ url: 'https://p.ro', title: 'Primăria', description: 'Site oficial' }],
        })}
        index={0}
      />,
    );
    expect(screen.getByText('lume').tagName).toBe('STRONG');
    expect(screen.getByText('Căutare web efectuată')).toBeTruthy();
    expect(screen.getByText('Surse:')).toBeTruthy();
    expect(screen.getByText('Primăria').closest('a')?.getAttribute('href')).toBe('https://p.ro');
    expect(screen.getByText('Site oficial')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
  });

  it('renders a user message as plain text with the IP avatar', () => {
    render(<MessageBubble message={{ sender: 'user', text: 'a\nb', time: '10:01' }} index={1} />);
    expect(screen.getByText('IP')).toBeTruthy();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'a\nb')).toBeTruthy();
    expect(screen.queryByText('Surse:')).toBeNull();
  });

  it('renders a marker message without confirmation buttons (the card lives in ChatView)', () => {
    render(<MessageBubble message={bot(STEP_2_REPLY)} index={3} />);
    expect(screen.queryByText('Da, e corect')).toBeNull();
    expect(screen.queryByText('Confirmă instituția identificată:')).toBeNull();
  });

  it('shows the retry button on an error message', () => {
    const onRetry = vi.fn();
    render(<MessageBubble message={bot('❌ Eroare', { isError: true })} index={0} onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Reîncearcă'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry without onRetry', () => {
    render(<MessageBubble message={bot('❌ Eroare', { isError: true })} index={0} />);
    expect(screen.queryByText('Reîncearcă')).toBeNull();
  });
});
