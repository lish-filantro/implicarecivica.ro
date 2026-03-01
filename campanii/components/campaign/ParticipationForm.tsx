"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  participationSchema,
  type ParticipationFormData,
} from "@/lib/validations/participation";
import type { Campaign } from "@/lib/types/campaign";
import { EmailPreview } from "./EmailPreview";
import { MailtoButton } from "./MailtoButton";
import { renderEmailBody } from "@/lib/mailto";
import { formatDate } from "@/lib/utils";
import { Send, CheckCircle } from "lucide-react";

interface ParticipationFormProps {
  campaign: Campaign;
  recipientCount: number;
  trackingEmail: string;
}

interface SubmitResult {
  emailData: {
    recipients: { name: string; email: string }[];
    subject: string;
    body: string;
  };
  campaign: {
    success_message: string | null;
    participation_count: number;
  };
}

export function ParticipationForm({
  campaign,
  recipientCount,
  trackingEmail,
}: ParticipationFormProps) {
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ParticipationFormData>({
    resolver: zodResolver(participationSchema),
  });

  const watchedName = watch("participant_name", "");
  const watchedCity = watch("participant_city", "");

  // Live preview of email body
  const previewBody = renderEmailBody(campaign.email_body, {
    nume_participant: watchedName || "[Numele tău]",
    oras_participant: watchedCity || "[Orașul tău]",
    data: formatDate(new Date()),
    organizatie: campaign.organization || undefined,
  });

  const fullPreviewBody = campaign.email_signature
    ? `${previewBody}\n\n${campaign.email_signature}`
    : previewBody;

  const onSubmit = async (data: ParticipationFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/campanii/${campaign.slug}/participa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "A apărut o eroare. Încearcă din nou.");
        return;
      }

      const result = await res.json();
      setSubmitResult(result);
    } catch {
      setError("Eroare de conexiune. Verifică internetul și încearcă din nou.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // After successful submission — show mailto button
  if (submitResult) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-grassroots-green-100 border-2 border-grassroots-green-500 p-6 text-center">
          <CheckCircle className="w-12 h-12 text-grassroots-green-500 mx-auto mb-3" />
          <h3 className="text-xl font-activist uppercase text-grassroots-green-700 mb-2">
            Participarea ta a fost înregistrată!
          </h3>
          <p className="text-urban-gray-600 mb-4">
            {submitResult.campaign.success_message || "Acum trebuie doar să trimiți emailul."}
          </p>
        </div>

        <MailtoButton
          recipients={submitResult.emailData.recipients}
          subject={submitResult.emailData.subject}
          body={submitResult.emailData.body}
          trackingEmail={trackingEmail}
          buttonText={campaign.submit_button_text || "Deschide emailul în clientul tău"}
        />

        <p className="text-sm text-urban-gray-500 text-center">
          Emailul va ajunge la toți cei {recipientCount} destinatari.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="participant_name" className="block text-sm font-semibold text-urban-gray-700 mb-1">
          Nume complet *
        </label>
        <input
          id="participant_name"
          {...register("participant_name")}
          className="input-modern"
          placeholder="Ion Popescu"
        />
        {errors.participant_name && (
          <p className="text-sm text-protest-red-500 mt-1">{errors.participant_name.message}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="participant_email" className="block text-sm font-semibold text-urban-gray-700 mb-1">
          Adresa de email *
        </label>
        <input
          id="participant_email"
          type="email"
          {...register("participant_email")}
          className="input-modern"
          placeholder="ion@exemplu.ro"
        />
        {errors.participant_email && (
          <p className="text-sm text-protest-red-500 mt-1">{errors.participant_email.message}</p>
        )}
      </div>

      {/* City (optional based on form_fields) */}
      {campaign.form_fields?.city && (
        <div>
          <label htmlFor="participant_city" className="block text-sm font-semibold text-urban-gray-700 mb-1">
            Oraș / Sector
          </label>
          <input
            id="participant_city"
            {...register("participant_city")}
            className="input-modern"
            placeholder="București, Sector 3"
          />
        </div>
      )}

      {/* Custom field */}
      {campaign.form_fields?.custom_field && (
        <div>
          <label htmlFor="custom_field_value" className="block text-sm font-semibold text-urban-gray-700 mb-1">
            {campaign.form_fields.custom_field}
          </label>
          <input
            id="custom_field_value"
            {...register("custom_field_value")}
            className="input-modern"
          />
        </div>
      )}

      {/* Email Preview */}
      <EmailPreview
        subject={campaign.email_subject}
        body={fullPreviewBody}
        recipientCount={recipientCount}
      />

      {/* GDPR */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="gdpr_consent"
          {...register("gdpr_consent")}
          className="mt-1 w-4 h-4 accent-civic-blue-500"
        />
        <label htmlFor="gdpr_consent" className="text-sm text-urban-gray-600">
          {campaign.gdpr_text || "Accept prelucrarea datelor conform GDPR pentru scopul acestei campanii."}
        </label>
      </div>
      {errors.gdpr_consent && (
        <p className="text-sm text-protest-red-500">{errors.gdpr_consent.message}</p>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-protest-red-100 border border-protest-red-300 p-3 rounded-lg text-sm text-protest-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-activist w-full flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          "Se înregistrează..."
        ) : (
          <>
            <Send className="w-5 h-5" />
            {campaign.submit_button_text || "Trimite emailul acum!"}
          </>
        )}
      </button>

      <p className="text-xs text-urban-gray-400 text-center">
        Emailul va ajunge la toți cei {recipientCount} destinatari
      </p>
    </form>
  );
}
