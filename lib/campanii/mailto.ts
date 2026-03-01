interface MailtoParams {
  recipients: { email: string }[];
  subject: string;
  body: string;
  trackingEmail: string;
}

export function renderEmailBody(
  template: string,
  data: {
    nume_participant: string;
    oras_participant?: string;
    data?: string;
    organizatie?: string;
  }
): string {
  let result = template;
  result = result.replace(/{nume_participant}/g, data.nume_participant);
  if (data.oras_participant) {
    result = result.replace(/{oras_participant}/g, data.oras_participant);
  }
  if (data.data) {
    result = result.replace(/{data}/g, data.data);
  }
  if (data.organizatie) {
    result = result.replace(/{organizatie}/g, data.organizatie);
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
