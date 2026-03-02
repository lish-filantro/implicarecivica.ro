interface MailtoParams {
  recipients: { email: string }[];
  subject: string;
  body: string;
  trackingEmail: string;
}

export function renderEmailBody(
  template: string,
  data: Record<string, string | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    if (value) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }
  return result;
}

export function generateMailtoUrl(params: MailtoParams): string {
  const to = params.recipients.map((r) => r.email).join(",");
  const parts = [
    `subject=${encodeURIComponent(params.subject)}`,
    `body=${encodeURIComponent(params.body)}`,
    `bcc=${encodeURIComponent(params.trackingEmail)}`,
  ];

  return `mailto:${to}?${parts.join("&")}`;
}

export function isMailtoTooLong(url: string): boolean {
  return url.length > 1800;
}
