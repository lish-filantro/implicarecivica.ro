interface CsvRecipient {
  name: string;
  role: string;
  email: string;
}

export function parseCsvRecipients(csvText: string): {
  recipients: CsvRecipient[];
  errors: string[];
} {
  const lines = csvText
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { recipients: [], errors: ["Fișierul CSV este gol"] };
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";

  const firstLine = lines[0].toLowerCase();
  const startIndex =
    firstLine.includes("name") ||
    firstLine.includes("nume") ||
    firstLine.includes("email")
      ? 1
      : 0;

  const recipients: CsvRecipient[] = [];
  const errors: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

    if (cols.length < 2) {
      errors.push(`Linia ${i + 1}: prea puține coloane`);
      continue;
    }

    const name = cols[0];
    const email = cols.length >= 3 ? cols[2] : cols[1];
    const role = cols.length >= 3 ? cols[1] : "";

    if (!name) {
      errors.push(`Linia ${i + 1}: numele lipsește`);
      continue;
    }

    if (!email || !email.includes("@")) {
      errors.push(`Linia ${i + 1}: email invalid "${email}"`);
      continue;
    }

    recipients.push({ name, role, email });
  }

  return { recipients, errors };
}
