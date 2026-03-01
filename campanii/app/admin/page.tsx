"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/lib/types/campaign";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { Plus, Eye, Edit, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";

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
    return <div className="text-center py-12 text-urban-gray-400">Se încarcă...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="heading-civic text-2xl">Campanii</h1>
        <a href="/admin/campanii/new" className="btn-activist flex items-center gap-2">
          <Plus className="w-4 h-4" /> Campanie nouă
        </a>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-urban-gray-300">
          <p className="text-urban-gray-400 mb-4">Nicio campanie creată încă</p>
          <a href="/admin/campanii/new" className="btn-activist inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Creează prima campanie
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-3 font-activist uppercase tracking-wide">Titlu</th>
                <th className="text-left py-3 font-activist uppercase tracking-wide">Status</th>
                <th className="text-right py-3 font-activist uppercase tracking-wide">Participări</th>
                <th className="text-right py-3 font-activist uppercase tracking-wide">Confirmate</th>
                <th className="text-left py-3 font-activist uppercase tracking-wide">Creat</th>
                <th className="text-center py-3 font-activist uppercase tracking-wide">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b hover:bg-urban-gray-50 transition-colors">
                  <td className="py-3">
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-xs text-urban-gray-400 font-mono">/{c.slug}</p>
                    </div>
                  </td>
                  <td className="py-3"><StatusBadge status={c.status} /></td>
                  <td className="py-3 text-right font-semibold">{c.participation_count}</td>
                  <td className="py-3 text-right font-semibold text-grassroots-green-600">{c.confirmed_count}</td>
                  <td className="py-3 text-xs text-urban-gray-500">{formatDate(c.created_at)}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/campanii/${c.slug}/edit`)}
                        className="p-1.5 hover:bg-urban-gray-100 rounded transition-colors"
                        title="Editează"
                      >
                        <Edit className="w-4 h-4 text-civic-blue-500" />
                      </button>
                      <button
                        onClick={() => router.push(`/admin/campanii/${c.slug}/stats`)}
                        className="p-1.5 hover:bg-urban-gray-100 rounded transition-colors"
                        title="Statistici"
                      >
                        <BarChart3 className="w-4 h-4 text-activist-orange-500" />
                      </button>
                      {c.status === "active" && (
                        <a
                          href={`/${c.slug}`}
                          target="_blank"
                          className="p-1.5 hover:bg-urban-gray-100 rounded transition-colors"
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
