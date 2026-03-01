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
      <p className="text-sm text-urban-gray-500 mb-3">
        {total} participări totale
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 font-activist uppercase tracking-wide">Data</th>
              <th className="text-left py-2 font-activist uppercase tracking-wide">Nume</th>
              <th className="text-left py-2 font-activist uppercase tracking-wide">Email</th>
              <th className="text-left py-2 font-activist uppercase tracking-wide">Oraș</th>
              <th className="text-center py-2 font-activist uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {participations.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2 text-xs text-urban-gray-500">
                  {formatDate(p.created_at)}
                </td>
                <td className="py-2">{p.participant_name}</td>
                <td className="py-2 font-mono text-xs text-urban-gray-500">
                  {maskEmail(p.participant_email)}
                </td>
                <td className="py-2 text-urban-gray-500">{p.participant_city || "\u2014"}</td>
                <td className="py-2 text-center">
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
                <td colSpan={5} className="py-8 text-center text-urban-gray-400">
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
