"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";

interface EmailPreviewProps {
  subject: string;
  body: string;
  recipientCount: number;
}

export function EmailPreview({ subject, body, recipientCount }: EmailPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-2 border-urban-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-urban-gray-50 hover:bg-urban-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-civic-blue-500" />
          <span className="font-semibold text-urban-gray-700">
            Vezi emailul pe care îl vei trimite
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-urban-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-urban-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 bg-white animate-fade-in">
          <div className="mb-3 pb-3 border-b border-urban-gray-200">
            <p className="text-sm text-urban-gray-500">
              <strong>Către:</strong> {recipientCount} destinatari
            </p>
            <p className="text-sm text-urban-gray-500">
              <strong>Subiect:</strong> {subject}
            </p>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-urban-gray-700 font-body leading-relaxed">
            {body}
          </pre>
        </div>
      )}
    </div>
  );
}
