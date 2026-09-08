// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatView from '@m544/ui/chat/ChatView';
import type { Message } from '@m544/shared/types/chat';

const messages: Message[] = [
  { sender: 'bot', text: 'Bună ziua!', time: '10:00' },
  { sender: 'user', text: 'Salut', time: '10:01' },
];

function renderView(overrides: Partial<React.ComponentProps<typeof ChatView>> = {}) {
  const props: React.ComponentProps<typeof ChatView> = {
    messages,
    inputMessage: '',
    setInputMessage: vi.fn(),
    onSendMessage: vi.fn(),
    isTyping: false,
    aiStatus: 'configured',
    ...overrides,
  };
  return { ...render(<ChatView {...props} />), props };
}

describe('ChatView', () => {
  beforeAll(() => {
    // jsdom has no layout; useAutoScroll calls scrollIntoView on the sentinel div
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders header, status badge and the messages', () => {
    renderView();
    expect(screen.getByText('Asistent 544')).toBeTruthy();
    expect(screen.getByText('✓ AI Activ')).toBeTruthy();
    expect(screen.getByText('Bună ziua!')).toBeTruthy();
    expect(screen.getByText('Salut')).toBeTruthy();
    expect(screen.getByPlaceholderText('Scrie-ți întrebarea aici...')).toBeTruthy();
  });

  it('shows the mock / loading badges', () => {
    const { rerender, props } = renderView({ aiStatus: 'mock' });
    expect(screen.getByText('⚠️ Mock')).toBeTruthy();
    rerender(<ChatView {...props} aiStatus="loading" />);
    expect(screen.getByText('...')).toBeTruthy();
  });

  it('disables textarea and send button while the assistant is typing', () => {
    renderView({ isTyping: true, inputMessage: 'ceva' });
    const textarea = screen.getByPlaceholderText('Scrie-ți întrebarea aici...') as HTMLTextAreaElement;
    const send = screen.getByLabelText('Trimite mesajul') as HTMLButtonElement;
    expect(textarea.disabled).toBe(true);
    expect(send.disabled).toBe(true);
    expect(screen.getByText('Se gândește...')).toBeTruthy(); // TypingIndicator
  });

  it('disables send when the input is blank, enables it otherwise and sends on click / Enter', () => {
    const { rerender, props } = renderView({ inputMessage: '   ' });
    const send = () => screen.getByLabelText('Trimite mesajul') as HTMLButtonElement;
    expect(send().disabled).toBe(true);

    rerender(<ChatView {...props} inputMessage="Întrebare" />);
    expect(send().disabled).toBe(false);
    fireEvent.click(send());
    expect(props.onSendMessage).toHaveBeenCalledTimes(1);

    const textarea = screen.getByPlaceholderText('Scrie-ți întrebarea aici...');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(props.onSendMessage).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(props.onSendMessage).toHaveBeenCalledTimes(2); // Shift+Enter = newline
  });

  it('forwards typing to setInputMessage and shows the mobile sidebar toggle only when provided', () => {
    const onToggleSidebar = vi.fn();
    const { props } = renderView({ onToggleSidebar });
    fireEvent.change(screen.getByPlaceholderText('Scrie-ți întrebarea aici...'), { target: { value: 'x' } });
    expect(props.setInputMessage).toHaveBeenCalledWith('x');
    fireEvent.click(screen.getByLabelText('Deschide conversații'));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('passes onRetry only to error messages', () => {
    const onRetry = vi.fn();
    renderView({
      messages: [...messages, { sender: 'bot', text: '❌ Eroare', time: '10:02', isError: true }],
      onRetry,
    });
    fireEvent.click(screen.getByText('Reîncearcă'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
