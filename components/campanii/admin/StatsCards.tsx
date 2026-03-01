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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-civic-blue-50 dark:bg-civic-blue-900/20">
            <Users className="w-4 h-4 text-civic-blue-500 dark:text-civic-blue-400" />
          </div>
          <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Participări</span>
        </div>
        <p className="text-3xl font-bold text-civic-blue-700 dark:text-civic-blue-400">{participationCount}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-grassroots-green-50 dark:bg-grassroots-green-900/20">
            <CheckCircle className="w-4 h-4 text-grassroots-green-500 dark:text-grassroots-green-400" />
          </div>
          <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Confirmate</span>
        </div>
        <p className="text-3xl font-bold text-grassroots-green-600 dark:text-grassroots-green-400">{confirmedCount}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-activist-orange-50 dark:bg-activist-orange-900/20">
            <TrendingUp className="w-4 h-4 text-activist-orange-500 dark:text-activist-orange-400" />
          </div>
          <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Rată confirmare</span>
        </div>
        <p className="text-3xl font-bold text-activist-orange-600 dark:text-activist-orange-400">{confirmRate}%</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </div>
          <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Zile active</span>
        </div>
        <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">{daysSinceCreation}</p>
      </div>
    </div>
  );
}
