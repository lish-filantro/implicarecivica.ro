"use client";

import { Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (navigator.share) {
          navigator.share({ title, url: window.location.href });
        } else {
          navigator.clipboard.writeText(window.location.href);
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-civic-blue-500 dark:hover:text-civic-blue-400 transition-colors"
    >
      <Share2 className="w-4 h-4" />
      Distribuie
    </button>
  );
}
