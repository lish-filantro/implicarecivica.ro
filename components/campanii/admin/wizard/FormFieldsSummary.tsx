"use client";

import { TEMPLATE_VARIABLES } from "@/lib/campanii/template-variables";
import { User, Mail, CheckCircle, Circle } from "lucide-react";

interface FormFieldsSummaryProps {
  usedVariables: string[];
  compact?: boolean;
}

export function FormFieldsSummary({
  usedVariables,
  compact = false,
}: FormFieldsSummaryProps) {
  // Always-present fields
  const alwaysFields = [
    { label: "Nume", icon: User, note: "obligatoriu" },
    { label: "Email", icon: Mail, note: "obligatoriu" },
  ];

  // Dynamic fields based on detected variables
  const detectedFields = TEMPLATE_VARIABLES.filter(
    (v) => v.category === "participant" && !v.alwaysRequired && v.formField
  );

  if (compact) {
    const activeCount =
      2 + detectedFields.filter((v) => usedVariables.includes(v.key)).length;
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">{activeCount} câmpuri</span> în
        formularul participantului
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Formular participant
      </p>
      <div className="space-y-1.5">
        {/* Always-present */}
        {alwaysFields.map(({ label, icon: Icon, note }) => (
          <div
            key={label}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <CheckCircle className="w-4 h-4 text-grassroots-green-500 shrink-0" />
            <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({note})
            </span>
          </div>
        ))}

        {/* Dynamic fields */}
        {detectedFields.map((v) => {
          const isActive = usedVariables.includes(v.key);
          return (
            <div
              key={v.key}
              className={`flex items-center gap-2 text-sm ${
                isActive
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-gray-300 dark:text-gray-600"
              }`}
            >
              {isActive ? (
                <CheckCircle className="w-4 h-4 text-grassroots-green-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
              )}
              <span>{v.label}</span>
              {isActive && (
                <span className="text-xs text-civic-blue-500 dark:text-civic-blue-400">
                  detectat din {v.tag}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
