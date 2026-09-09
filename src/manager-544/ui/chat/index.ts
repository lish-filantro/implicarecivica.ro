// Chat UI: components + hooks
export { default as MessageBubble } from './MessageBubble';
export { default as TypingIndicator } from './TypingIndicator';
export { default as MarkdownRenderer } from './MarkdownRenderer';
export { default as ChatView } from './ChatView';
export { default as InstitutionCard } from './InstitutionCard';
export { default as HandoffBar } from './HandoffBar';
export { default as ConversationSidebar } from './ConversationSidebar';
export { default as ChatScreen, ConversationLoading } from './ChatScreen';
export { default as ChatLayoutShell } from './ChatLayoutShell';
export { useConversation } from './hooks/useConversation';
export { useChatApi } from './hooks/useChatApi';
export { useConversationMessages } from './hooks/useConversationMessages';
export { useHandoff, buildHandoff } from './hooks/useHandoff';
export { useAutoScroll } from './hooks/useAutoScroll';
export { useTypingIndicator } from './hooks/useTypingIndicator';
export { ChatSidebarProvider, useChatSidebar } from './hooks/useChatSidebar';
