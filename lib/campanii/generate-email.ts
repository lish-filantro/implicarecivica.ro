import { slugify } from "@/lib/utils";
import { EMAIL_DOMAIN } from "@/lib/resend";

const MAX_LOCAL_PART_LENGTH = 40;

/**
 * Generate a campaign email address from the campaign title.
 * Example: "Transparență în Primăria Cluj-Napoca" → "transparenta-in-primaria-cluj-napoca@implicarecivica.ro"
 *
 * Truncates at the last complete word boundary within MAX_LOCAL_PART_LENGTH.
 */
export function generateCampaignEmail(title: string): string {
  const slug = slugify(title);

  let localPart = slug;
  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    // Truncate at last hyphen before the limit
    const truncated = localPart.substring(0, MAX_LOCAL_PART_LENGTH);
    const lastHyphen = truncated.lastIndexOf("-");
    localPart = lastHyphen > 0 ? truncated.substring(0, lastHyphen) : truncated;
  }

  return `${localPart}@${EMAIL_DOMAIN}`;
}

/**
 * Generate a unique campaign email, appending a numeric suffix if needed.
 * The `isUnique` callback checks the database for existing emails.
 */
export async function generateUniqueCampaignEmail(
  title: string,
  isUnique: (email: string) => Promise<boolean>
): Promise<string> {
  const baseEmail = generateCampaignEmail(title);

  if (await isUnique(baseEmail)) {
    return baseEmail;
  }

  const [localPart, domain] = baseEmail.split("@");
  for (let i = 2; i <= 99; i++) {
    const candidate = `${localPart}-${i}@${domain}`;
    if (await isUnique(candidate)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback
  const random = Math.random().toString(36).substring(2, 6);
  return `${localPart}-${random}@${EMAIL_DOMAIN}`;
}
