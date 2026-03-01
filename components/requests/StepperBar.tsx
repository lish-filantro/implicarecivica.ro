'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface StepperBarProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { number: 1, label: 'Date cerere' },
  { number: 2, label: 'Selectează întrebări' },
  { number: 3, label: 'Previzualizare' },
];

export function StepperBar({ currentStep }: StepperBarProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isActive = currentStep === step.number;

          return (
            <React.Fragment key={step.number}>
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-grassroots-green-500 border-grassroots-green-500 text-white'
                      : isActive
                      ? 'bg-civic-blue-600 border-civic-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <span
                  className={`mt-2 text-xs font-medium hidden sm:block ${
                    isActive
                      ? 'text-civic-blue-700 dark:text-civic-blue-300'
                      : isCompleted
                      ? 'text-grassroots-green-600 dark:text-grassroots-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 sm:mx-6 transition-colors duration-300 ${
                    currentStep > step.number
                      ? 'bg-grassroots-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
