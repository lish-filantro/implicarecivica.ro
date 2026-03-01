import { Users, CheckCircle, TrendingUp, Clock } from "lucide-react";

interface StatsCardsProps {
  participationCount: number;
  confirmedCount: number;
  createdAt: string;
}

export function StatsCards({ participationCount, confirmedCount, createdAt }: StatsCardsProps) {
  const confirmRate =
    participationCount > 0
      ? Math.round((confirmedCount / participationCount) * 100)
      : 0;

  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card-modern">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-civic-blue-500" />
          <span className="text-xs font-semibold uppercase text-urban-gray-500">Participări</span>
        </div>
        <p className="text-3xl font-activist font-black text-civic-blue-700">{participationCount}</p>
      </div>

      <div className="card-modern">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-5 h-5 text-grassroots-green-500" />
          <span className="text-xs font-semibold uppercase text-urban-gray-500">Confirmate</span>
        </div>
        <p className="text-3xl font-activist font-black text-grassroots-green-600">{confirmedCount}</p>
      </div>

      <div className="card-modern">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-activist-orange-500" />
          <span className="text-xs font-semibold uppercase text-urban-gray-500">Rată confirmare</span>
        </div>
        <p className="text-3xl font-activist font-black text-activist-orange-600">{confirmRate}%</p>
      </div>

      <div className="card-modern">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-urban-gray-500" />
          <span className="text-xs font-semibold uppercase text-urban-gray-500">Zile active</span>
        </div>
        <p className="text-3xl font-activist font-black text-urban-gray-700">{daysSinceCreation}</p>
      </div>
    </div>
  );
}
