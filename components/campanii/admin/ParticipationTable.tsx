import type { CampaignParticipation } from "@/lib/campanii/types/campaign";
import { formatDate } from "@/lib/utils";
import { CheckCircle, Clock } from "lucide-react";

interface ParticipationTableProps {
  participations: CampaignParticipation[];
  total: number;
}

export function ParticipationTable({ participations, total }: ParticipationTableProps) {
  const maskEmail = (email: string | null) => {
    if (!email) return "\u2014";
    const [user, domain] = email.split("@");
    if (!domain) return "\u2014";
    return `${user[0]}***@${domain}`;
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {total} participări totale
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Data</th>
              <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nume</th>
              <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</th>
              <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Oraș</th>
              <th className="text-center py-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {participations.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="py-2 px-2 text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(p.created_at)}
                </td>
                <td className="py-2 px-2 text-gray-900 dark:text-white">{p.participant_name}</td>
                <td className="py-2 px-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {maskEmail(p.participant_email)}
                </td>
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{p.participant_city || "\u2014"}</td>
                <td className="py-2 px-2 text-center">
                  {p.email_status === "confirmed" ? (
                    <span className="badge-status badge-status-green">
                      <CheckCircle className="w-3 h-3" /> Confirmat
                    </span>
                  ) : (
                    <span className="badge-status badge-status-yellow">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {participations.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-gray-500">
                  Nicio participare încă
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
