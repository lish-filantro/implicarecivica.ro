import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for auto-scroll functionality in chat interfaces
 * Handles smooth scrolling, user interaction detection, and scroll state management
 */
export const useAutoScroll = (dependencies: any[] = []) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Smooth scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior,
        block: 'end',
        inline: 'nearest'
      });
    }
  };

  // Check if user is at bottom of scroll
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const threshold = 5; // 5px threshold for "at bottom"

    return scrollHeight - scrollTop - clientHeight <= threshold;
  };

  // Handle scroll events
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const atBottom = isAtBottom();
    setIsUserScrolling(!atBottom);

    // Re-enable auto-scroll if user scrolls back to bottom
    if (atBottom && !isAutoScrollEnabled) {
      setIsAutoScrollEnabled(true);
    }
  };

  // Auto-scroll when dependencies change
  useEffect(() => {
    if (isAutoScrollEnabled && !isUserScrolling) {
      // Small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        scrollToBottom('smooth');
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, dependencies);

  // Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Force scroll to bottom (for new chat, etc.)
  const forceScrollToBottom = () => {
    setIsAutoScrollEnabled(true);
    setIsUserScrolling(false);
    scrollToBottom('auto'); // Instant scroll
  };

  return {
    messagesEndRef,
    messagesContainerRef,
    isAutoScrollEnabled,
    isUserScrolling,
    scrollToBottom,
    forceScrollToBottom,
    isAtBottom
  };
};
