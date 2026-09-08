/**
 * Display helpers for the admin dashboard.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "acum 5 min" / "acum 3 ore" / "acum 2 zile" / "niciodată"; unparsable dates fall back to the raw value. */
export function formatLastInbound(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'niciodată';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Math.max(0, now.getTime() - t);
  if (diff < MINUTE) return 'acum';
  if (diff < HOUR) return `acum ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return hours === 1 ? 'acum 1 oră' : `acum ${hours} ore`;
  }
  const days = Math.floor(diff / DAY);
  return days === 1 ? 'acum 1 zi' : `acum ${days} zile`;
}
