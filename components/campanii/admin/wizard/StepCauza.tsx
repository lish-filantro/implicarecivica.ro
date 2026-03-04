"use client";

import type { UseFormReturn } from "react-hook-form";
import type { WizardFormData } from "@/lib/campanii/validations/wizard";
import type { CampaignRecipient } from "@/lib/campanii/types/campaign";
import { RecipientTable } from "../RecipientTable";
import { ImageUpload } from "../ImageUpload";
import { slugify } from "@/lib/utils";
import { Users, Mail } from "lucide-react";

interface StepCauzaProps {
  form: UseFormReturn<WizardFormData>;
  recipients: CampaignRecipient[];
  onRecipientsChange: (recipients: CampaignRecipient[]) => void;
  campaignSlug?: string | null;
  campaignEmail?: string | null;
  isEdit: boolean;
}

export function StepCauza({
  form,
  recipients,
  onRecipientsChange,
  campaignSlug,
  campaignEmail,
  isEdit,
}: StepCauzaProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEdit) {
      setValue("slug", slugify(e.target.value));
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700">
          Despre ce e campania?
        </h2>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Titlu campanie *
          </label>
          <input
            {...register("title", { onChange: handleTitleChange })}
            className="input-modern"
            placeholder='Ex: "Fără auto prin Pădurea Băneasa"'
          />
          {errors.title && (
            <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">
              {errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Slug URL *
          </label>
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span>implicarecivica.ro/campanii/</span>
            <span className="font-mono text-civic-blue-500 dark:text-civic-blue-400">
              {watch("slug") || "..."}
            </span>
          </div>
          <input {...register("slug")} className="input-modern font-mono" />
          {errors.slug && (
            <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">
              {errors.slug.message}
            </p>
          )}
        </div>

        {campaignEmail && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Email campanie
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
              <Mail className="w-4 h-4 text-civic-blue-500 dark:text-civic-blue-400 shrink-0" />
              <span className="font-mono text-gray-700 dark:text-gray-300">{campaignEmail}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Generat automat. Folosit pentru tracking BCC și inbox campanie.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Descriere scurtă
          </label>
          <input
            {...register("short_description")}
            className="input-modern"
            maxLength={300}
            placeholder="O propoziție care rezumă campania (max 300 caractere)"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Descriere detaliată / Context
          </label>
          <textarea
            {...register("long_description")}
            className="input-modern min-h-[120px]"
            placeholder="Context detaliat: de ce e importantă cauza, ce s-a întâmplat, ce vrem să schimbăm..."
          />
        </div>

        <ImageUpload
          value={watch("cover_image_url")}
          onChange={(url) => setValue("cover_image_url", url)}
        />

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Organizație inițiatoare
          </label>
          <input
            {...register("organization")}
            className="input-modern"
            placeholder="Ex: Asociația Civică XYZ"
          />
        </div>
      </section>

      {/* Recipients */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Cui trimiți emailul?
        </h2>

        {recipients.length === 0 && (
          <div className="bg-warning-yellow-50 dark:bg-warning-yellow-900/20 border border-warning-yellow-200 dark:border-warning-yellow-800 p-3 rounded-lg text-sm text-warning-yellow-700 dark:text-warning-yellow-300">
            Trebuie cel puțin un destinatar pentru a continua.
          </div>
        )}

        <RecipientTable
          campaignSlug={campaignSlug || undefined}
          initialRecipients={recipients}
          onRecipientsChange={onRecipientsChange}
        />
      </section>
    </div>
  );
}
