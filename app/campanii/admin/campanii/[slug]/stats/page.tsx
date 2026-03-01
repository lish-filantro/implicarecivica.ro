"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminAuthGuard } from "@/components/campanii/admin/AdminAuthGuard";
import { StatsCards } from "@/components/campanii/admin/StatsCards";
import { ParticipationTable } from "@/components/campanii/admin/ParticipationTable";
import type { CampaignParticipation } from "@/lib/campanii/types/campaign";
import { ArrowLeft, Download } from "lucide-react";

interface StatsData {
  campaign: {
    id: string;
    title: string;
    slug: string;
    status: string;
    participation_count: number;
    confirmed_count: number;
    created_at: string;
  };
  participations: CampaignParticipation[];
  total: number;
  stats: {
    dailyCounts: Record<string, number>;
    cityCounts: Record<string, number>;
  };
}

function StatsContent() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campanii/${slug}/stats`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return <div className="text-center py-12 text-urban-gray-400">Se încarcă...</div>;
  }

  if (!data?.campaign) {
    return <div className="text-center py-12 text-protest-red-500">Campanie negăsită</div>;
  }

  const { campaign, participations, total, stats } = data;

  const dailyEntries = Object.entries(stats.dailyCounts).sort(([a], [b]) => a.localeCompare(b));
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-8">
      <div>
        <a
          href={`/campanii/admin/campanii/${slug}/edit`}
          className="inline-flex items-center gap-1 text-sm text-civic-blue-500 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi la campanie
        </a>
        <h1 className="heading-civic text-2xl">Statistici: {campaign.title}</h1>
      </div>

      <StatsCards
        participationCount={campaign.participation_count}
        confirmedCount={campaign.confirmed_count}
        createdAt={campaign.created_at}
      />

      {dailyEntries.length > 0 && (
        <div className="card-modern">
          <h3 className="text-sm font-activist uppercase text-urban-gray-500 mb-4">
            Participări pe zi (ultimele 30 zile)
          </h3>
          <div className="flex items-end gap-1 h-32">
            {dailyEntries.map(([day, count]) => (
              <div
                key={day}
                className="flex-1 bg-civic-blue-500 hover:bg-civic-blue-600 transition-colors rounded-t relative group"
                style={{ height: `${(count / maxDaily) * 100}%`, minHeight: "4px" }}
                title={`${day}: ${count} participări`}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-urban-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {count}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-urban-gray-400 mt-1">
            <span>{dailyEntries[0]?.[0]?.slice(5)}</span>
            <span>{dailyEntries[dailyEntries.length - 1]?.[0]?.slice(5)}</span>
          </div>
        </div>
      )}

      {Object.keys(stats.cityCounts).length > 0 && (
        <div className="card-modern">
          <h3 className="text-sm font-activist uppercase text-urban-gray-500 mb-4">
            Pe orașe
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.cityCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([city, count]) => (
                <div key={city} className="flex items-center gap-3">
                  <span className="text-sm w-32 truncate">{city}</span>
                  <div className="flex-1 bg-urban-gray-100 rounded-full h-4">
                    <div
                      className="bg-activist-orange-500 h-4 rounded-full"
                      style={{ width: `${(count / total) * 100}%`, minWidth: "8px" }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="card-modern">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-activist uppercase text-urban-gray-500">
            Participări recente
          </h3>
          <button className="text-sm text-civic-blue-500 hover:underline flex items-center gap-1">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
        <ParticipationTable participations={participations} total={total} />
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <AdminAuthGuard>
      <StatsContent />
    </AdminAuthGuard>
  );
}
