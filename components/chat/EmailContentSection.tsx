'use client';

import React from 'react';

interface EmailContentSectionProps {
  title: string;
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
}

/**
 * Email content section component for the main request content
 * This remains a textarea since it's the main variable content
 */
const EmailContentSection: React.FC<EmailContentSectionProps> = ({
  title,
  content,
  onContentChange,
  placeholder = ''
}) => {
  return (
    <div className="form-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
          <div className="w-2 h-2 bg-activist-orange-500 rounded-full mr-2"></div>
          {title}
          <span className="text-activist-orange-600 dark:text-activist-orange-400 ml-1">*</span>
        </h3>
      </div>

      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-24 px-3 py-3 border border-urban-gray-100 dark:border-urban-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50 focus:border-civic-blue-500 resize-none text-sm bg-white/60 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-urban-gray-300 dark:hover:border-urban-gray-600"
        required={true}
      />

      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        ⚠️ IMPORTANT: Completează aici conținutul specific al cererii tale!
      </div>
    </div>
  );
};

export default EmailContentSection;
