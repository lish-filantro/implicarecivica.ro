"use client";

import {
  TEMPLATE_VARIABLES,
  getVariablesByCategory,
} from "@/lib/campanii/template-variables";
import {
  User,
  MapPin,
  Briefcase,
  Building2,
  Phone,
  Hash,
  Map,
  Calendar,
  Flag,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  User,
  MapPin,
  Briefcase,
  Building2,
  Phone,
  Hash,
  Map,
  Calendar,
  Flag,
};

const CATEGORY_LABELS: Record<string, string> = {
  participant: "Participant",
  campaign: "Campanie",
  meta: "Auto-generat",
};

interface TagPaletteProps {
  usedVariables: string[];
  onInsert: (variableKey: string) => void;
  compact?: boolean;
}

export function TagPalette({
  usedVariables,
  onInsert,
  compact = false,
}: TagPaletteProps) {
  const groups = getVariablesByCategory();

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATE_VARIABLES.map((v) => {
          const Icon = ICON_MAP[v.icon];
          const isUsed = usedVariables.includes(v.key);
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => onInsert(v.key)}
              title={v.description}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all
                ${
                  isUsed
                    ? "bg-civic-blue-100 dark:bg-civic-blue-900/30 border-civic-blue-300 dark:border-civic-blue-700 text-civic-blue-700 dark:text-civic-blue-300"
                    : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-civic-blue-50 dark:hover:bg-civic-blue-900/20 hover:border-civic-blue-200 dark:hover:border-civic-blue-800"
                }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {v.label}
              {isUsed && <span className="text-grassroots-green-500 ml-0.5">&#10003;</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Inserează variabilă
      </p>
      {Object.entries(groups).map(([category, variables]) => (
        <div key={category}>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
            {CATEGORY_LABELS[category]}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => {
              const Icon = ICON_MAP[v.icon];
              const isUsed = usedVariables.includes(v.key);
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => onInsert(v.key)}
                  title={v.description}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${
                      isUsed
                        ? "bg-civic-blue-100 dark:bg-civic-blue-900/30 border-civic-blue-300 dark:border-civic-blue-700 text-civic-blue-700 dark:text-civic-blue-300"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-civic-blue-50 dark:hover:bg-civic-blue-900/20 hover:border-civic-blue-200 dark:hover:border-civic-blue-800"
                    }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {v.label}
                  {isUsed && (
                    <span className="text-grassroots-green-500">&#10003;</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
