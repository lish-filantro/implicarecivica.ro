'use client';

import React from 'react';

interface TypingIndicatorProps {
  text?: string;
  showDots?: boolean;
}

/**
 * Typing indicator component with animated dots
 * Shows when AI is processing/thinking
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  text = 'Se gândește...',
  showDots = true
}) => {
  return (
    <div className="flex items-start">
      <div className="flex-shrink-0">
        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg ring-2 ring-blue-100 dark:ring-blue-900/30">
          <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      </div>
      <div className="ml-2 sm:ml-3 max-w-[85%] sm:max-w-xl">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 border border-gray-200/50 dark:border-gray-700/50 shadow-md">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{text}</span>
            {showDots && (
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
