"use client";

import { CheckCircle, Share2, ArrowRight } from "lucide-react";

interface SuccessScreenProps {
  message: string;
  redirectUrl?: string | null;
  campaignTitle: string;
  campaignUrl: string;
}

export function SuccessScreen({
  message,
  redirectUrl,
  campaignTitle,
  campaignUrl,
}: SuccessScreenProps) {
  const shareText = `Am trimis emailul pentru campania "${campaignTitle}". Fă și tu la fel!`;
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(campaignUrl);

  return (
    <div className="text-center space-y-6 py-8 animate-fade-in">
      <CheckCircle className="w-16 h-16 text-grassroots-green-500 mx-auto" />

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Mulțumim!
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">{message}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-civic flex items-center gap-2 text-sm"
        >
          <Share2 className="w-4 h-4" />
          Distribuie pe Facebook
        </a>

        <a
          href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-civic flex items-center gap-2 text-sm bg-grassroots-green-600 hover:bg-grassroots-green-700 border-grassroots-green-700"
        >
          <Share2 className="w-4 h-4" />
          Distribuie pe WhatsApp
        </a>
      </div>

      {redirectUrl && (
        <a
          href={redirectUrl}
          className="inline-flex items-center gap-2 text-civic-blue-500 dark:text-civic-blue-400 hover:underline"
        >
          Continuă <ArrowRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
