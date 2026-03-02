import { z } from "zod";

export const participationSchema = z.object({
  participant_name: z.string().min(2, "Numele e obligatoriu").max(200),
  participant_email: z.string().email("Adresă de email invalidă"),
  participant_city: z.string().max(100).optional(),
  custom_field_value: z.string().max(500).optional(),
  participant_profession: z.string().max(200).optional(),
  participant_organization: z.string().max(200).optional(),
  participant_phone: z.string().max(20).optional(),
  participant_sector: z.string().max(20).optional(),
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: "Trebuie să accepți prelucrarea datelor" }),
  }),
});

export type ParticipationFormData = z.infer<typeof participationSchema>;
