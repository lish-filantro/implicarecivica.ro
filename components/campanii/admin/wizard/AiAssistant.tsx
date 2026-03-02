"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface AiAssistantProps {
  defaultCauseDescription?: string;
  defaultRecipientContext?: string;
  onGenerate: (params: {
    causeDescription: string;
    tone: "formal" | "empatic" | "urgent";
    keyPoints: string[];
    recipientContext: string;
  }) => Promise<void>;
  loading: boolean;
  error: string | null;
  hasExistingEmail: boolean;
}

type Tone = "formal" | "empatic" | "urgent";

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: "formal", label: "Formal", description: "Limbaj instituțional, Dvs." },
  { value: "empatic", label: "Empatic", description: "Ton personal, cetățenesc" },
  { value: "urgent", label: "Urgent", description: "Ton direct, deadline-uri" },
];

export function AiAssistant({
  defaultCauseDescription = "",
  defaultRecipientContext = "",
  onGenerate,
  loading,
  error,
  hasExistingEmail,
}: AiAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [causeDescription, setCauseDescription] = useState(defaultCauseDescription);
  const [recipientContext, setRecipientContext] = useState(defaultRecipientContext);
  const [tone, setTone] = useState<Tone>("formal");
  const [keyPointsText, setKeyPointsText] = useState("");

  const handleGenerate = () => {
    const keyPoints = keyPointsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    onGenerate({
      causeDescription,
      tone,
      keyPoints,
      recipientContext,
    });
  };

  return (
    <div className="bg-gradient-to-r from-civic-blue-50 to-activist-orange-50 dark:from-civic-blue-900/20 dark:to-activist-orange-900/20 rounded-xl border border-civic-blue-200 dark:border-civic-blue-800">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-activist-orange-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Asistent AI
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            — generează emailul automat
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-civic-blue-100 dark:border-civic-blue-800 pt-3">
          {/* Cause description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Descrie cauza (pe scurt)
            </label>
            <textarea
              value={causeDescription}
              onChange={(e) => setCauseDescription(e.target.value)}
              className="input-modern min-h-[80px] text-sm"
              placeholder="Ex: Pădurea Băneasa este amenințată de trafic auto. Vrem publicarea raportului și interzicerea circulației..."
            />
          </div>

          {/* Recipient context */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Cui te adresezi?
            </label>
            <input
              value={recipientContext}
              onChange={(e) => setRecipientContext(e.target.value)}
              className="input-modern text-sm"
              placeholder="Ex: Ministrul Mediului, Primarul General"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
              Ton
            </label>
            <div className="flex gap-2">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTone(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    tone === opt.value
                      ? "bg-civic-blue-600 border-civic-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-civic-blue-300"
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key points */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Puncte cheie (unul pe linie)
            </label>
            <textarea
              value={keyPointsText}
              onChange={(e) => setKeyPointsText(e.target.value)}
              className="input-modern min-h-[60px] text-sm"
              placeholder={"Publicarea raportului\nInterzicerea traficului auto\nSancționarea responsabililor"}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-protest-red-500 dark:text-protest-red-400 bg-protest-red-50 dark:bg-protest-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !causeDescription.trim()}
            className="btn-activist flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Se generează...
              </>
            ) : hasExistingEmail ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerează emailul
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generează emailul
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
