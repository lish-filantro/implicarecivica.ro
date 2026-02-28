'use client';

import React from 'react';

interface Field {
  key: string;
  label: string;
  value: string;
  placeholder: string;
}

interface EmailSolicitantSectionProps {
  title: string;
  fields: Field[];
  onFieldChange: (field: string, value: string) => void;
  onPreserveToggle: () => void;
  preserve: boolean;
  showPreserveCheckbox?: boolean;
}

/**
 * Special component for Solicitant section with 2x2 grid layout
 * Optimized for compact display of personal information
 */
const EmailSolicitantSection: React.FC<EmailSolicitantSectionProps> = ({
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

      {/* Custom Layout: Name & Email on top row, Address full width below */}
      <div className="space-y-3">
        {/* Top Row: Name and Email */}
        <div className="grid grid-cols-2 gap-3">
          {fields.filter(f => f.key !== 'address').map((field, index) => (
            <div key={index} className="space-y-1">
              <label className="label-muted font-semibold mb-1">
                {field.label}:
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full field-input"
              />
            </div>
          ))}
        </div>

        {/* Bottom Row: Address (Full Width) */}
        {fields.filter(f => f.key === 'address').map((field, index) => (
          <div key={index} className="space-y-1 relative group">
            <label className="label-muted font-semibold mb-1 flex justify-between">
              <span>{field.label}:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={field.value}
                onChange={(e) => onFieldChange(field.key, e.target.value)}
                placeholder=""
                className="w-full field-input pr-4"
              />
              {!field.value && (
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-gray-400 dark:text-gray-500 text-xs italic truncate">
                  Ex: Str. Victoriei nr. 10, Bl. 5, Sc. A, Ap. 2, Sector 1, București
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailSolicitantSection;
