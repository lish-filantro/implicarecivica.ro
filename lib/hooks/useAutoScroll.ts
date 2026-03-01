import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for auto-scroll functionality in chat interfaces.
 * Scrolls to bottom when new content appears, but only if user was already at bottom.
 * Uses requestAnimationFrame for smooth, immediate scrolling after DOM updates.
 */
export const useAutoScroll = (dependencies: any[] = []) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const isAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    // 50px threshold — accommodates scroll inertia on mobile touch
    return scrollHeight - scrollTop - clientHeight <= 50;
  }, []);

  // Track whether user was at bottom BEFORE content update
  const handleScroll = useCallback(() => {
    wasAtBottomRef.current = isAtBottom();
  }, [isAtBottom]);

  // Scroll on dependency change, ONLY if user was at bottom
  useEffect(() => {
    if (wasAtBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const forceScrollToBottom = useCallback(() => {
    wasAtBottomRef.current = true;
    scrollToBottom('auto');
  }, [scrollToBottom]);

  return {
    messagesEndRef,
    messagesContainerRef,
    forceScrollToBottom,
    isAtBottom,
  };
};
