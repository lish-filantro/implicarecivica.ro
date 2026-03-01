"use client";

import { Mail, ExternalLink } from "lucide-react";
import { generateMailtoUrl, isMailtoTooLong } from "@/lib/campanii/mailto";

interface MailtoButtonProps {
  recipients: { email: string }[];
  subject: string;
  body: string;
  trackingEmail: string;
  buttonText?: string;
}

export function MailtoButton({
  recipients,
  subject,
  body,
  trackingEmail,
  buttonText = "Deschide emailul în clientul tău",
}: MailtoButtonProps) {
  const mailtoUrl = generateMailtoUrl({ recipients, subject, body, trackingEmail });
  const tooLong = isMailtoTooLong(mailtoUrl);

  return (
    <div className="space-y-3">
      <a
        href={mailtoUrl}
        className="btn-activist inline-flex items-center gap-2 text-center justify-center w-full text-lg animate-pulse-activist"
      >
        <Mail className="w-5 h-5" />
        {buttonText}
        <ExternalLink className="w-4 h-4" />
      </a>

      <p className="text-sm text-urban-gray-500 text-center">
        Se va deschide aplicația ta de email (Gmail, Outlook, etc.) cu emailul deja completat.
        Trebuie doar să apeși <strong>Send / Trimite</strong>.
      </p>

      {tooLong && (
        <p className="text-xs text-warning-yellow-700 bg-warning-yellow-100 p-2 rounded">
          Emailul are mulți destinatari. Dacă clientul tău de email nu îi încarcă pe toți,
          copiază adresele manual.
        </p>
      )}
    </div>
  );
}
