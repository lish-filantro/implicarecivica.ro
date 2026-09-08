// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversationSidebar, { type SidebarQueries } from '@m544/ui/chat/ConversationSidebar';
import type { ConversationListItem } from '@m544/shared/types/chat';

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
let pathname = '/chat';
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const items: ConversationListItem[] = [
  { id: 'c1', title: 'Groapă pe strada mea', updatedAt: new Date().toISOString(), messageCount: 4, currentStep: 'STEP_2' },
  { id: 'c2', title: 'Iluminat public', updatedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), messageCount: 2, currentStep: 'STEP_1' },
];

function fakeQueries(list: ConversationListItem[] = items) {
  const queries: SidebarQueries = {
    listConversations: vi.fn(async () => list),
    deleteConversation: vi.fn(async () => undefined),
  };
  return queries;
}

describe('ConversationSidebar', () => {
  beforeEach(() => {
    router.push.mockClear();
    pathname = '/chat';
  });

  it('lists the conversations with relative time, message count and step label', async () => {
    render(<ConversationSidebar queries={fakeQueries()} />);
    await waitFor(() => expect(screen.getByText('Groapă pe strada mea')).toBeTruthy());
    expect(screen.getByText('Iluminat public')).toBeTruthy();
    expect(screen.getByText('acum')).toBeTruthy();
    expect(screen.getByText('3h')).toBeTruthy();
    expect(screen.getByText('4 mesaje')).toBeTruthy();
    expect(screen.getByText('Instituție')).toBeTruthy();
    expect(screen.getByText('Definire')).toBeTruthy();
  });

  it('shows the empty state when there are no conversations', async () => {
    const queries = fakeQueries([]);
    render(<ConversationSidebar queries={queries} />);
    await waitFor(() => expect(queries.listConversations).toHaveBeenCalled());
    expect(screen.getByText('Nicio conversație încă')).toBeTruthy();
  });

  it('navigates on click and calls onNavigate', async () => {
    const onNavigate = vi.fn();
    render(<ConversationSidebar queries={fakeQueries()} onNavigate={onNavigate} />);
    await waitFor(() => screen.getByText('Iluminat public'));
    fireEvent.click(screen.getByText('Iluminat public'));
    expect(router.push).toHaveBeenCalledWith('/chat/c2');
    expect(onNavigate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Conversație nouă'));
    expect(router.push).toHaveBeenCalledWith('/chat');
  });

  it('delete asks for confirmation; cancel keeps the conversation', async () => {
    const queries = fakeQueries();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ConversationSidebar queries={queries} />);
    await waitFor(() => screen.getByText('Groapă pe strada mea'));
    fireEvent.click(screen.getAllByTitle('Șterge')[0]);
    expect(window.confirm).toHaveBeenCalledWith('Ștergi conversația?');
    expect(queries.deleteConversation).not.toHaveBeenCalled();
    expect(screen.getByText('Groapă pe strada mea')).toBeTruthy();
  });

  it('delete confirmed removes it from the list and leaves the active conversation', async () => {
    pathname = '/chat/c1';
    const queries = fakeQueries();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ConversationSidebar queries={queries} />);
    await waitFor(() => screen.getByText('Groapă pe strada mea'));
    fireEvent.click(screen.getAllByTitle('Șterge')[0]);
    await waitFor(() => expect(queries.deleteConversation).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Groapă pe strada mea')).toBeNull());
    expect(router.push).toHaveBeenCalledWith('/chat');
  });

  it('collapses and expands', async () => {
    render(<ConversationSidebar queries={fakeQueries()} />);
    fireEvent.click(screen.getByTitle('Ascunde sidebar'));
    expect(screen.queryByText('Conversații')).toBeNull();
    fireEvent.click(screen.getByTitle('Deschide sidebar'));
    expect(screen.getByText('Conversații')).toBeTruthy();
  });
});
