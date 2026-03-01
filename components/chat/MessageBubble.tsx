'use client';

import React, { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import type { Message } from '@/lib/types/chat';

interface MessageBubbleProps {
  message: Message;
  index: number;
  isLast?: boolean;
  onConfirmInstitution?: () => void;
  onManualEntry?: () => void;
}

/**
 * Message bubble component with smooth animations
 * Shows confirmation buttons after STEP_2 institution identification
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  index,
  isLast = false,
  onConfirmInstitution,
  onManualEntry,
}) => {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const hasInstitution = isBot && message.text.includes('INSTITUȚIE_IDENTIFICATĂ');
  const showConfirmation = hasInstitution && isLast && !confirmed;

  return (
    <div
      className={`flex items-start ${isUser ? 'justify-end' : ''} animate-fade-in`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {isBot && (
        <div className="flex-shrink-0">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg ring-2 ring-blue-100 dark:ring-blue-900/30">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
      )}

      <div className={`max-w-xl ${isUser ? 'mr-3' : 'ml-3'}`}>
        <div className={`rounded-2xl px-4 py-3 transition-all duration-300 hover:shadow-lg backdrop-blur-sm ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
            : 'bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 shadow-md'
        }`}>
          {/* Web search indicator */}
          {isBot && message.webSearches && message.webSearches.length > 0 && (
            <div className="mb-2 flex items-center text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2 py-1">
              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-medium">Căutare web efectuată</span>
            </div>
          )}

          {/* Message text with markdown support */}
          <div className={`text-sm ${
            isUser ? 'text-white' : 'text-gray-800 dark:text-gray-200'
          }`}>
            {isBot ? (
              <MarkdownRenderer content={message.text} />
            ) : (
              <p className="whitespace-pre-line">{message.text}</p>
            )}
          </div>

          {/* Web sources */}
          {isBot && message.webSources && message.webSources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Surse:
              </p>
              <ul className="space-y-2">
                {message.webSources.map((source, idx) => (
                  <li key={idx} className="text-xs">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium flex items-start transition-colors"
                    >
                      <span className="mr-1">[{idx + 1}]</span>
                      <span className="flex-1">{source.title}</span>
                      <svg className="h-3 w-3 ml-1 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    {source.description && (
                      <p className="text-gray-600 dark:text-gray-400 ml-5 mt-1">{source.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* STEP_2 Confirmation buttons */}
          {showConfirmation && (
            <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Confirmă instituția identificată:
              </p>

              {!showRejectOptions ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setConfirmed(true);
                      onConfirmInstitution?.();
                    }}
                    className="px-4 py-2 text-sm font-medium bg-grassroots-green-500 hover:bg-grassroots-green-600 text-white rounded-lg transition-colors shadow-sm"
                  >
                    Da, e corect
                  </button>
                  <button
                    onClick={() => setShowRejectOptions(true)}
                    className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    Nu
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ce dorești să faci?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowRejectOptions(false)}
                      className="px-4 py-2 text-sm font-medium bg-civic-blue-100 dark:bg-civic-blue-900/20 hover:bg-civic-blue-200 dark:hover:bg-civic-blue-900/30 text-civic-blue-700 dark:text-civic-blue-300 rounded-lg transition-colors"
                    >
                      Caută din nou
                    </button>
                    <button
                      onClick={() => {
                        setConfirmed(true);
                        onManualEntry?.();
                      }}
                      className="px-4 py-2 text-sm font-medium bg-activist-orange-100 dark:bg-activist-orange-900/20 hover:bg-activist-orange-200 dark:hover:bg-activist-orange-900/30 text-activist-orange-700 dark:text-activist-orange-300 rounded-lg transition-colors"
                    >
                      Introducere manuală
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className={`text-xs mt-2 ${
            isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {message.time}
          </p>
        </div>
      </div>

      {isUser && (
        <div className="ml-3">
          <div className="h-10 w-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-lg ring-2 ring-gray-100 dark:ring-gray-800/30">
            IP
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
