"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/lib/campanii/types/campaign";
import { AdminAuthGuard } from "@/components/campanii/admin/AdminAuthGuard";
import { Plus, Eye, Edit, BarChart3, Megaphone, Inbox } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/loading-spinner";

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    draft: "badge-status badge-status-yellow",
    active: "badge-status badge-status-green",
    archived: "badge-status badge-status-red",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    active: "Activ",
    archived: "Arhivat",
  };

  return <span className={classes[status] || ""}>{labels[status] || status}</span>;
}

function AdminDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/campanii")
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-activist-orange-50 dark:bg-activist-orange-900/20">
            <Megaphone className="h-5 w-5 text-activist-orange-600 dark:text-activist-orange-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Campanii</h1>
        </div>
        <a href="/campanii/admin/campanii/new" className="btn-activist flex items-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" /> Campanie nouă
        </a>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <p className="text-gray-400 dark:text-gray-500 mb-4">Nicio campanie creată încă</p>
          <a href="/campanii/admin/campanii/new" className="btn-activist inline-flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Creează prima campanie
          </a>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Titlu</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Participări</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Confirmate</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Creat</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{c.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">/campanii/{c.slug}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">{c.participation_count}</td>
                    <td className="py-3 px-4 text-right font-semibold text-grassroots-green-600 dark:text-grassroots-green-400">{c.confirmed_count}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">{formatDate(c.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/campanii/admin/campanii/${c.slug}/edit`)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Editează"
                        >
                          <Edit className="w-4 h-4 text-civic-blue-500" />
                        </button>
                        <button
                          onClick={() => router.push(`/campanii/admin/campanii/${c.slug}/stats`)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Statistici"
                        >
                          <BarChart3 className="w-4 h-4 text-activist-orange-500" />
                        </button>
                        <button
                          onClick={() => router.push(`/campanii/admin/campanii/${c.slug}/stats?tab=inbox`)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Inbox campanie"
                        >
                          <Inbox className="w-4 h-4 text-civic-blue-500" />
                        </button>
                        {c.status === "active" && (
                          <a
                            href={`/campanii/${c.slug}`}
                            target="_blank"
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Pagina publică"
                          >
                            <Eye className="w-4 h-4 text-grassroots-green-500" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminAuthGuard>
      <AdminDashboard />
    </AdminAuthGuard>
  );
}
