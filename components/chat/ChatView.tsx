'use client';

import React from 'react';
import type { Message } from '@/lib/types/chat';
import { useAutoScroll } from '@/lib/hooks/useAutoScroll';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';

interface ChatViewProps {
  messages: Message[];
  inputMessage: string;
  setInputMessage: (value: string) => void;
  onSendMessage: () => void;
  isTyping: boolean;
  aiStatus: 'loading' | 'configured' | 'mock';
  onConfirmInstitution?: () => void;
  onManualEntry?: () => void;
}

export default function ChatView({
  messages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  isTyping,
  aiStatus,
  onConfirmInstitution,
  onManualEntry,
}: ChatViewProps) {
  const {
    messagesEndRef,
    messagesContainerRef,
  } = useAutoScroll([messages]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSendMessage();
    }
  };

  return (
    <div className="flex h-full">
      {/* Full-width Chatbot */}
      <div className="w-full flex flex-col bg-white dark:bg-gray-800">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                Asistent 544
                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                  aiStatus === 'configured'
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : aiStatus === 'mock'
                    ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                    : 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300'
                }`}>
                  {aiStatus === 'configured' ? '✓ AI Activ' : aiStatus === 'mock' ? '⚠️ Mock Mode' : '...'}
                </span>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Ajutor pentru formularea cererilor de informații publice
              </p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-gradient-to-b from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 scrollbar-modern"
        >
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id || index}
              message={msg}
              index={index}
              isLast={index === messages.length - 1}
              onConfirmInstitution={index === messages.length - 1 ? onConfirmInstitution : undefined}
              onManualEntry={index === messages.length - 1 ? onManualEntry : undefined}
            />
          ))}

          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="px-6 py-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <div className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Scrie-ți întrebarea aici..."
              disabled={isTyping}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
            />
            <button
              onClick={onSendMessage}
              disabled={isTyping || !inputMessage.trim()}
              className="px-6 py-3 bg-gradient-to-r from-civic-blue-600 to-civic-blue-700 hover:from-civic-blue-700 hover:to-civic-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
