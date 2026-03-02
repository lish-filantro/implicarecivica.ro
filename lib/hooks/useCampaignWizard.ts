"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignRecipient, FormFieldsConfig } from "@/lib/campanii/types/campaign";
import {
  wizardSchema,
  step1Schema,
  step2Schema,
  type WizardFormData,
} from "@/lib/campanii/validations/wizard";
import {
  detectUsedVariables,
  deriveFormFields,
  renderWithSampleData,
} from "@/lib/campanii/template-variables";

export type WizardStep = 1 | 2 | 3;

interface UseCampaignWizardOptions {
  campaign?: Campaign;
  initialRecipients?: CampaignRecipient[];
}

export function useCampaignWizard(options?: UseCampaignWizardOptions) {
  const router = useRouter();
  const campaign = options?.campaign;

  // --- Step navigation ---
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // --- Form (single instance for all steps) ---
  const form: UseFormReturn<WizardFormData> = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
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
          title: "",
          slug: "",
          short_description: "",
          long_description: "",
          cover_image_url: "",
          organization: "",
          email_subject: "",
          email_body: "",
          email_signature: "",
          submit_button_text: "Trimite emailul acum!",
          success_message: "",
          redirect_url: "",
          sending_method: "mailto",
          form_fields: {
            city: false,
            postal_code: false,
            custom_field: null,
            profession: false,
            participant_organization: false,
            phone: false,
            sector: false,
          },
          gdpr_text:
            "Accept prelucrarea datelor conform GDPR pentru scopul acestei campanii.",
          status: "draft",
          expires_at: "",
        },
  });

  // --- Recipients (local state, synced to DB separately) ---
  const [recipients, setRecipients] = useState<CampaignRecipient[]>(
    options?.initialRecipients || []
  );

  // --- Textarea refs for cursor tracking ---
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);
  const emailSubjectRef = useRef<HTMLTextAreaElement>(null);

  // --- Tag insertion at cursor position ---
  const insertTag = useCallback(
    (variableKey: string, target: "subject" | "body") => {
      const ref = target === "subject" ? emailSubjectRef : emailBodyRef;
      const textarea = ref.current;
      if (!textarea) return;

      const tag = `{${variableKey}}`;
      const { selectionStart, selectionEnd } = textarea;
      const fieldName =
        target === "subject" ? "email_subject" : "email_body";
      const currentValue = (form.getValues(fieldName) as string) || "";

      const newValue =
        currentValue.substring(0, selectionStart) +
        tag +
        currentValue.substring(selectionEnd);

      form.setValue(fieldName, newValue, {
        shouldDirty: true,
        shouldValidate: true,
      });

      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        textarea.focus();
        const newCursorPos = selectionStart + tag.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [form]
  );

  // --- AI state ---
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateEmail = useCallback(
    async (params: {
      causeDescription: string;
      tone: "formal" | "empatic" | "urgent";
      keyPoints: string[];
      recipientContext: string;
    }) => {
      setAiLoading(true);
      setAiError(null);

      try {
        const res = await fetch("/api/campanii/generate-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            causeDescription: params.causeDescription,
            recipientContext: params.recipientContext,
            tone: params.tone,
            keyPoints: params.keyPoints,
            existingSubject: form.getValues("email_subject") || undefined,
            existingBody: form.getValues("email_body") || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setAiError(err.error || "Eroare la generare");
          return;
        }

        const data = await res.json();
        if (data.subject) {
          form.setValue("email_subject", data.subject, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
        if (data.body) {
          form.setValue("email_body", data.body, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      } catch {
        setAiError("Eroare de conexiune cu AI");
      } finally {
        setAiLoading(false);
      }
    },
    [form]
  );

  // --- Computed: detected variables & derived form fields ---
  const watchedBody = form.watch("email_body") || "";
  const watchedSubject = form.watch("email_subject") || "";

  const usedVariables = useMemo(
    () => detectUsedVariables(watchedSubject + " " + watchedBody),
    [watchedSubject, watchedBody]
  );

  const derivedFormFields: FormFieldsConfig = useMemo(
    () => deriveFormFields(usedVariables),
    [usedVariables]
  );

  // --- Computed: live preview ---
  const previewSubject = useMemo(
    () => renderWithSampleData(watchedSubject),
    [watchedSubject]
  );
  const previewBody = useMemo(
    () => renderWithSampleData(watchedBody),
    [watchedBody]
  );

  // --- Step validation gates ---
  const watchedTitle = form.watch("title") || "";
  const watchedSlug = form.watch("slug") || "";

  const canProceedToStep2 = useMemo(() => {
    const result = step1Schema.safeParse({
      title: watchedTitle,
      slug: watchedSlug,
      short_description: form.getValues("short_description"),
      long_description: form.getValues("long_description"),
      cover_image_url: form.getValues("cover_image_url"),
      organization: form.getValues("organization"),
    });
    return result.success && recipients.length > 0;
  }, [watchedTitle, watchedSlug, recipients.length, form]);

  const canProceedToStep3 = useMemo(() => {
    const result = step2Schema.safeParse({
      email_subject: watchedSubject,
      email_body: watchedBody,
      email_signature: form.getValues("email_signature"),
    });
    return result.success;
  }, [watchedSubject, watchedBody, form]);

  // --- Save handlers ---
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(
    campaign?.slug || null
  );

  const saveRecipients = useCallback(
    async (campaignSlug: string) => {
      // Only save recipients that don't have a real ID (local-only)
      const localRecipients = recipients.filter((r) =>
        r.id.startsWith("local-")
      );
      if (localRecipients.length === 0) return;

      for (const r of localRecipients) {
        await fetch(`/api/campanii/${campaignSlug}/recipients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: r.name,
            role: r.role || null,
            email: r.email,
          }),
        });
      }
    },
    [recipients]
  );

  const saveCampaign = useCallback(
    async (status?: "draft" | "active") => {
      setSaving(true);
      setSaveError(null);

      try {
        const values = form.getValues();
        const payload = {
          ...values,
          form_fields: derivedFormFields,
          ...(status ? { status } : {}),
        };

        const isEdit = !!savedSlug && !!campaign;
        const url = isEdit
          ? `/api/campanii/${savedSlug}`
          : "/api/campanii";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          setSaveError(err.error || "Eroare la salvare");
          return null;
        }

        const result = await res.json();
        setSavedSlug(result.slug);

        // Sync local recipients to DB
        await saveRecipients(result.slug);

        return result as Campaign;
      } catch {
        setSaveError("Eroare de conexiune");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [form, derivedFormFields, savedSlug, campaign, saveRecipients]
  );

  const saveDraft = useCallback(
    () => saveCampaign("draft"),
    [saveCampaign]
  );

  const publish = useCallback(async () => {
    const result = await saveCampaign("active");
    if (result) {
      router.push(`/campanii/admin/campanii/${result.slug}/edit`);
      router.refresh();
    }
    return result;
  }, [saveCampaign, router]);

  return {
    // Navigation
    currentStep,
    setStep: setCurrentStep,
    // Form
    form,
    // Recipients
    recipients,
    setRecipients,
    // Tag system
    emailBodyRef,
    emailSubjectRef,
    insertTag,
    usedVariables,
    derivedFormFields,
    // AI
    aiLoading,
    aiError,
    generateEmail,
    // Preview
    previewSubject,
    previewBody,
    // Validation gates
    canProceedToStep2,
    canProceedToStep3,
    // Save
    saving,
    saveError,
    savedSlug,
    saveDraft,
    publish,
  };
}
