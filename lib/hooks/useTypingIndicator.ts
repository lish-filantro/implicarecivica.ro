import { useState, useEffect } from 'react';

/**
 * Custom hook for typing indicator functionality
 * Manages typing state and provides smooth animations
 */
export const useTypingIndicator = () => {
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('Se gândește...');

  // Typing animation states
  const typingStates = [
    'Se gândește...',
    'Se gândește.',
    'Se gândește..',
    'Se gândește...'
  ];

  // Start typing indicator
  const startTyping = (customText: string = 'Se gândește...') => {
    setIsTyping(true);
    setTypingText(customText);
  };

  // Stop typing indicator
  const stopTyping = () => {
    setIsTyping(false);
  };

  // Animate typing text
  useEffect(() => {
    if (!isTyping) return;

    let intervalId: NodeJS.Timeout;
    let stateIndex = 0;

    const animate = () => {
      setTypingText(typingStates[stateIndex]);
      stateIndex = (stateIndex + 1) % typingStates.length;
    };

    intervalId = setInterval(animate, 500);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTyping]);

  return {
    isTyping,
    typingText,
    startTyping,
    stopTyping
  };
};
