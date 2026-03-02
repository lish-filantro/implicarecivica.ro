import { z } from "zod";

// Step 1 — Cauza & Destinatari
export const step1Schema = z.object({
  title: z.string().min(5, "Minim 5 caractere").max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Doar litere mici, cifre și cratimă")
    .min(3)
    .max(100),
  short_description: z.string().max(300).optional().nullable(),
  long_description: z.string().optional().nullable(),
  cover_image_url: z.string().optional().or(z.literal("")).nullable(),
  organization: z.string().max(200).optional().nullable(),
});

// Step 2 — Compune emailul
export const step2Schema = z.object({
  email_subject: z.string().min(5, "Subiectul e obligatoriu").max(200),
  email_body: z
    .string()
    .min(20, "Corpul emailului trebuie să aibă minim 20 caractere"),
  email_signature: z.string().optional().nullable(),
});

// Step 3 — Previzualizare & Publică
export const step3Schema = z.object({
  submit_button_text: z.string().max(100).optional().nullable(),
  success_message: z.string().max(500).optional().nullable(),
  gdpr_text: z.string().max(1000).optional().nullable(),
  redirect_url: z.string().url().optional().or(z.literal("")).nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  expires_at: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val || null),
  sending_method: z.enum(["mailto", "resend"]).default("mailto"),
});

// Full wizard schema
export const wizardSchema = step1Schema.merge(step2Schema).merge(step3Schema).extend({
  form_fields: z
    .object({
      city: z.boolean(),
      postal_code: z.boolean(),
      custom_field: z.string().nullable(),
      profession: z.boolean().optional(),
      participant_organization: z.boolean().optional(),
      phone: z.boolean().optional(),
      sector: z.boolean().optional(),
    })
    .optional(),
});

export type WizardFormData = z.infer<typeof wizardSchema>;
export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
