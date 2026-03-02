"use client";

import type { UseFormReturn } from "react-hook-form";
import type { WizardFormData } from "@/lib/campanii/validations/wizard";
import { DevicePreview } from "./DevicePreview";
import { EmailPreviewPane } from "./EmailPreviewPane";
import { FormFieldsSummary } from "./FormFieldsSummary";
import { Eye } from "lucide-react";

interface StepPreviewProps {
  form: UseFormReturn<WizardFormData>;
  previewSubject: string;
  previewBody: string;
  usedVariables: string[];
  recipientCount: number;
}

export function StepPreview({
  form,
  previewSubject,
  previewBody,
  usedVariables,
  recipientCount,
}: StepPreviewProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const watchedSignature = watch("email_signature") || "";

  return (
    <div className="space-y-6">
      {/* Device Preview */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5" />
          Cum va arăta emailul
        </h2>
        <DevicePreview>
          <div className="p-4">
            <EmailPreviewPane
              subject={previewSubject}
              body={previewBody}
              signature={watchedSignature}
              recipientCount={recipientCount}
            />
          </div>
        </DevicePreview>
      </section>

      {/* Form Fields Summary */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
          Câmpuri formular participant
        </h2>
        <FormFieldsSummary usedVariables={usedVariables} />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Câmpurile se generează automat din variabilele folosite în email.
        </p>
      </section>

      {/* Final Settings */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700">
          Setări finale
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Text buton trimitere
            </label>
            <input
              {...register("submit_button_text")}
              className="input-modern"
              placeholder="Trimite emailul acum!"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select {...register("status")} className="input-modern">
              <option value="draft">Draft</option>
              <option value="active">Activ</option>
              <option value="archived">Arhivat</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Mesaj de succes
          </label>
          <input
            {...register("success_message")}
            className="input-modern"
            placeholder="Mulțumim! Emailul tău contează."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Text GDPR
          </label>
          <textarea
            {...register("gdpr_text")}
            className="input-modern min-h-[60px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Expiră la (opțional)
            </label>
            <input
              {...register("expires_at")}
              className="input-modern"
              type="datetime-local"
            />
            {errors.expires_at && (
              <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">
                {errors.expires_at.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              URL redirect după trimitere
            </label>
            <input
              {...register("redirect_url")}
              className="input-modern"
              type="url"
              placeholder="https://..."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
