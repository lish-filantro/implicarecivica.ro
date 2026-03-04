"use client";

import { useEffect, useState, useCallback } from "react";
import type { CampaignMessage } from "@/lib/campanii/types/campaign-message";
import { Mail, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

interface CampaignInboxProps {
  slug: string;
}

export function CampaignInbox({ slug }: CampaignInboxProps) {
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/campanii/${slug}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleExpand = async (msg: CampaignMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(msg.id);

    // Mark as read if unread
    if (!msg.is_read) {
      await fetch(`/api/campanii/${slug}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: [msg.id] }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m))
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          Niciun mesaj primit încă.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Mailurile cu subiect diferit de cel al campaniei vor apărea aici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {total} {total === 1 ? "mesaj" : "mesaje"} primite
      </p>
      {messages.map((msg) => {
        const isExpanded = expandedId === msg.id;
        const date = new Date(msg.received_at);

        return (
          <div
            key={msg.id}
            className={`border rounded-lg overflow-hidden transition-colors ${
              msg.is_read
                ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                : "border-civic-blue-200 dark:border-civic-blue-800 bg-civic-blue-50/50 dark:bg-civic-blue-900/10"
            }`}
          >
            <button
              onClick={() => handleExpand(msg)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {!msg.is_read && (
                <span className="w-2 h-2 rounded-full bg-civic-blue-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {msg.from_name || msg.from_email}
                  </span>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {msg.subject}
                </p>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                {date.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                <div className="pt-3 space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                    <p>
                      <span className="font-medium">De la:</span> {msg.from_email}
                    </p>
                    <p>
                      <span className="font-medium">Data:</span>{" "}
                      {date.toLocaleString("ro-RO")}
                    </p>
                  </div>
                  {msg.body ? (
                    <div
                      className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: msg.body }}
                    />
                  ) : (
                    <p className="text-sm text-gray-400 italic">(fără conținut)</p>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Atașamente ({msg.attachments.length})
                      </p>
                      <div className="space-y-1">
                        {msg.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{att.name}</span>
                            <span className="text-gray-400">
                              ({Math.round(att.size / 1024)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
