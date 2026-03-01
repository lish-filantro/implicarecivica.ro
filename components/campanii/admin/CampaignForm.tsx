"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { campaignSchema, type CampaignFormData } from "@/lib/campanii/validations/campaign";
import type { Campaign } from "@/lib/campanii/types/campaign";
import { slugify } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye } from "lucide-react";

interface CampaignFormProps {
  campaign?: Campaign;
}

export function CampaignForm({ campaign }: CampaignFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign
      ? {
          title: campaign.title,
          slug: campaign.slug,
          short_description: campaign.short_description || "",
          long_description: campaign.long_description || "",
          cover_image_url: campaign.cover_image_url || "",
          organization: campaign.organization || "",
          email_subject: campaign.email_subject,
          email_body: campaign.email_body,
          email_signature: campaign.email_signature || "",
          submit_button_text: campaign.submit_button_text || "Trimite emailul acum!",
          success_message: campaign.success_message || "",
          redirect_url: campaign.redirect_url || "",
          sending_method: campaign.sending_method,
          form_fields: campaign.form_fields,
          gdpr_text: campaign.gdpr_text || "",
          status: campaign.status,
          expires_at: campaign.expires_at || "",
        }
      : {
          status: "draft",
          sending_method: "mailto",
          form_fields: { city: false, postal_code: false, custom_field: null },
          submit_button_text: "Trimite emailul acum!",
          gdpr_text: "Accept prelucrarea datelor conform GDPR pentru scopul acestei campanii.",
        },
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    if (!campaign) {
      setValue("slug", slugify(title));
    }
  };

  const onSubmit = async (data: CampaignFormData) => {
    setSaving(true);
    setError(null);

    try {
      const url = campaign ? `/api/campanii/${campaign.slug}` : "/api/campanii";
      const method = campaign ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Eroare la salvare");
        return;
      }

      const result = await res.json();
      router.push(`/campanii/admin/campanii/${result.slug}/edit`);
      router.refresh();
    } catch {
      setError("Eroare de conexiune");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-3xl">
      {/* Basic Info */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700">
          Informații de bază
        </h2>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Titlu campanie *</label>
          <input
            {...register("title", { onChange: handleTitleChange })}
            className="input-modern"
            placeholder='ex: "Mărirea amenzii pentru tăiere ilegală copaci"'
          />
          {errors.title && <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Slug URL *</label>
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span>implicarecivica.ro/campanii/</span>
            <span className="font-mono text-civic-blue-500 dark:text-civic-blue-400">{watch("slug") || "..."}</span>
          </div>
          <input {...register("slug")} className="input-modern font-mono" />
          {errors.slug && <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">{errors.slug.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Descriere scurtă (max 300 caractere)</label>
          <input {...register("short_description")} className="input-modern" maxLength={300} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Descriere lungă / Context</label>
          <textarea {...register("long_description")} className="input-modern min-h-[150px]" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Imagine cover (URL)</label>
            <input {...register("cover_image_url")} className="input-modern" type="url" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Organizație inițiatoare</label>
            <input {...register("organization")} className="input-modern" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select {...register("status")} className="input-modern">
              <option value="draft">Draft</option>
              <option value="active">Activ</option>
              <option value="archived">Arhivat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Expiră la (opțional)</label>
            <input {...register("expires_at")} className="input-modern" type="datetime-local" />
            {errors.expires_at && <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">{errors.expires_at.message}</p>}
          </div>
        </div>
      </section>

      {/* Email Template */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700">
          Template Email
        </h2>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Subiect email *</label>
          <input {...register("email_subject")} className="input-modern" />
          {errors.email_subject && (
            <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">{errors.email_subject.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Corp email *</label>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
            Variabile disponibile: {"{nume_participant}"}, {"{oras_participant}"}, {"{data}"},{" "}
            {"{organizatie}"}
          </p>
          <textarea {...register("email_body")} className="input-modern min-h-[200px] font-mono text-sm" />
          {errors.email_body && (
            <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">{errors.email_body.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Semnătură (opțional)</label>
          <textarea {...register("email_signature")} className="input-modern min-h-[80px] font-mono text-sm" />
        </div>
      </section>

      {/* Form Settings */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-200 dark:border-gray-700">
          Setări formular
        </h2>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("form_fields.city")} className="w-4 h-4 accent-civic-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Cere orașul / sectorul</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("form_fields.postal_code")}
              className="w-4 h-4 accent-civic-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Cere codul poștal</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Text buton submit</label>
          <input {...register("submit_button_text")} className="input-modern" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mesaj de succes</label>
          <input {...register("success_message")} className="input-modern" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Text GDPR</label>
          <textarea {...register("gdpr_text")} className="input-modern min-h-[60px]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">URL redirect după trimitere (opțional)</label>
          <input {...register("redirect_url")} className="input-modern" type="url" />
        </div>
      </section>

      {/* Error & Submit */}
      {error && (
        <div className="bg-protest-red-100 dark:bg-protest-red-900/20 border border-protest-red-300 dark:border-protest-red-700 p-3 rounded-lg text-sm text-protest-red-700 dark:text-protest-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-activist flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Se salvează..." : campaign ? "Salvează modificările" : "Creează campania"}
        </button>

        {campaign && campaign.status === "active" && (
          <a
            href={`/campanii/${campaign.slug}`}
            target="_blank"
            className="btn-civic flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Vezi pagina publică
          </a>
        )}
      </div>
    </form>
  );
}
