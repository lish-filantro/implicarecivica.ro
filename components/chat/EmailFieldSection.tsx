'use client';

import React from 'react';

interface Field {
  key: string;
  label: string;
  value: string;
  placeholder: string;
  staticText?: string;
}

interface EmailFieldSectionProps {
  title: string;
  fields: Field[];
  onFieldChange: (field: string, value: string) => void;
  onPreserveToggle: () => void;
  preserve: boolean;
  showPreserveCheckbox?: boolean;
}

/**
 * Email field section component for individual field management
 * Handles sections with individual input fields instead of large textareas
 */
const EmailFieldSection: React.FC<EmailFieldSectionProps> = ({
  title,
  fields,
  onFieldChange,
  onPreserveToggle,
  preserve,
  showPreserveCheckbox = true
}) => {
  return (
    <div className="form-section">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
          <div className="w-2 h-2 bg-civic-blue-500 rounded-full mr-2"></div>
          {title}
        </h3>
        {showPreserveCheckbox && (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={preserve}
              onChange={onPreserveToggle}
              className="h-4 w-4 text-civic-blue-600 focus:ring-civic-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 transition-all duration-200"
            />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Păstrează pentru următorul mail</span>
          </label>
        )}
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={index} className="space-y-1">
            {field.staticText ? (
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
                {field.staticText.split('[').map((part, partIndex) => {
                  if (partIndex === 0) {
                    return <span key={partIndex}>{part}</span>;
                  }
                  const [beforeBracket, afterBracket] = part.split(']');
                  return (
                    <span key={partIndex}>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => onFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="inline-token"
                      />
                      {afterBracket}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-0 flex-shrink-0">
                  {field.label}:
                </span>
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="flex-1 field-input"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailFieldSection;
