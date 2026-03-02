import { z } from "zod";

export const campaignSchema = z.object({
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
  email_subject: z.string().min(5, "Subiectul e obligatoriu").max(200),
  email_body: z.string().min(20, "Corpul emailului trebuie să aibă minim 20 caractere"),
  email_signature: z.string().optional().nullable(),
  submit_button_text: z.string().max(100).optional().nullable(),
  success_message: z.string().max(500).optional().nullable(),
  redirect_url: z.string().url().optional().or(z.literal("")).nullable(),
  sending_method: z.enum(["mailto", "resend"]).default("mailto"),
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
  gdpr_text: z.string().max(1000).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  expires_at: z.string().optional().nullable().transform((val) => val || null),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

export const recipientSchema = z.object({
  name: z.string().min(2, "Numele e obligatoriu").max(200),
  role: z.string().max(200).optional().nullable(),
  email: z.string().email("Email invalid"),
});

export type RecipientFormData = z.infer<typeof recipientSchema>;
